import type { Pool, PoolClient } from "pg";
import type {
  DashboardData,
  OperationalTask,
  Patient,
} from "../../src/types/dashboard.ts";
import { generateAlerts } from "../../src/utils/alertRules.ts";
export async function readDashboard(client: PoolClient) {
  const latest = (
    await client.query(
      "SELECT * FROM reporting.department_hourly ORDER BY snapshot_time DESC LIMIT 1",
    )
  ).rows[0];
  if (!latest)
    return {
      state: "empty",
      data: null,
      source: "postgresql",
      synthetic: true,
    };
  const snapshot = latest.snapshot_time.toISOString();
  const patients: Patient[] = (
    await client.query(
      "SELECT * FROM reporting.latest_patients ORDER BY elapsed_minutes DESC,visit_id",
    )
  ).rows.map((p) => ({
    id: p.visit_id,
    arrivalTime: p.arrival_time.toISOString(),
    triageLevel: p.triage_level,
    stage: p.stage,
    area: p.area_name,
    waitingMinutes: Number(p.elapsed_minutes),
    assignedBed: p.bed_id || undefined,
    lastUpdated: snapshot,
    status: ["Red", "Orange"].includes(p.triage_level)
      ? "Priority"
      : Number(p.elapsed_minutes) > 30
        ? "Delayed"
        : "Stable",
  }));
  const events = (
    await client.query(
      "SELECT e.*,a.area_name FROM flow_events e JOIN areas a USING(area_id) WHERE visit_id=ANY($1::text[]) AND stage_start < $2 ORDER BY stage_start,event_id",
      [patients.map((p) => p.id), snapshot],
    )
  ).rows;
  for (const patient of patients) {
    const activeEvent = events.find(
      (e) =>
        e.visit_id === patient.id &&
        (!e.stage_end || e.stage_end.getTime() >= Date.parse(snapshot)),
    );
    if (activeEvent) {
      patient.stageStartedAt = activeEvent.stage_start.toISOString();
      patient.stageMinutes = Math.max(
        0,
        Math.round(
          (Date.parse(snapshot) - activeEvent.stage_start.getTime()) / 60000,
        ),
      );
    }
    patient.timeline = events
      .filter((e) => e.visit_id === patient.id)
      .map((e) => ({
        label: e.stage,
        at: e.stage_start.toISOString(),
        description: `${e.area_name}${e.bed_id ? ` · Space ${e.bed_id}` : ""}`,
      }));
  }
  const followups = (
    await client.query(
      "SELECT * FROM transfer_followups WHERE snapshot_time=$1 ORDER BY id DESC",
      [snapshot],
    )
  ).rows.map((r) => ({
    id: Number(r.id),
    patientId: r.visit_id,
    blocker: r.blocker,
    owner: r.owner,
    status: r.status,
    note: r.note,
    recordedAt: r.recorded_at.toISOString(),
  }));
  const areas = (
    await client.query(
      "SELECT * FROM reporting.area_capacity_hourly WHERE snapshot_time=$1 ORDER BY area_id",
      [snapshot],
    )
  ).rows.map((a) => ({
    area: a.area_name,
    staffedCapacity: a.staffed_capacity,
    occupied: a.occupied,
    waiting: a.waiting,
    staffOnDuty: null,
  }));
  const history = (
    await client.query(
      "SELECT to_char(hour_start AT TIME ZONE 'Asia/Kolkata','HH24') AS hour,arrivals,departures FROM reporting.department_hourly WHERE snapshot_time <= $1 ORDER BY snapshot_time DESC LIMIT 12",
      [snapshot],
    )
  ).rows.reverse();
  const base = {
    scenario: "normal" as const,
    patients,
    areas,
    history,
    updatedAt: snapshot,
    followups,
  };
  // Historical datasets are intentionally old; they are not a failed live feed.
  const alerts = generateAlerts(base, { historical: true });
  const actions = (
    await client.query(
      "SELECT * FROM operational_actions WHERE snapshot_time=$1",
      [snapshot],
    )
  ).rows;
  const tasks: OperationalTask[] = alerts
    .filter((a) => a.severity !== "Information")
    .map((a) => ({
      id: `task-${a.id}`,
      relatedAlertId: a.id,
      description: a.suggestedAction,
      assignedRole: "ED coordinator",
      priority: a.severity === "Critical" ? "High" : "Medium",
      status: actions.find((s) => s.alert_id === a.id)?.task_status || "Open",
    }));
  for (const alert of alerts)
    if (actions.find((s) => s.alert_id === alert.id)?.acknowledged)
      alert.status = "Acknowledged";
  const data: DashboardData = { ...base, alerts, tasks };
  return {
    state: "ready",
    data,
    source: "postgresql",
    synthetic: true,
    snapshotDate: snapshot,
    summary: {
      active: latest.active_patients,
      waiting: latest.patients_waiting,
      average: Number(latest.average_elapsed_wait_minutes),
      occupied: latest.occupied_beds,
      capacity: latest.staffed_beds,
    },
  };
}
export async function getDashboard(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await readDashboard(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function saveAction(pool: Pool, body: Record<string, unknown>) {
  if (
    typeof body.snapshotTime !== "string" ||
    !Number.isFinite(Date.parse(body.snapshotTime)) ||
    typeof body.alertId !== "string" ||
    !["acknowledge", "task"].includes(String(body.kind))
  )
    throw new Error("INVALID_ACTION");
  if (
    body.kind === "task" &&
    !["Open", "In Progress", "Completed"].includes(String(body.status))
  )
    throw new Error("INVALID_ACTION");
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const current = await readDashboard(client);
    if (
      !current.data ||
      current.data.updatedAt !== new Date(body.snapshotTime).toISOString()
    )
      throw new Error("STALE_SNAPSHOT");
    const alert = current.data.alerts.find((a) => a.id === body.alertId);
    if (!alert || (body.kind === "task" && alert.severity === "Information"))
      throw new Error("INVALID_ACTION");
    if (body.kind === "acknowledge")
      await client.query(
        "INSERT INTO operational_actions(snapshot_time,alert_id,acknowledged) VALUES($1,$2,true) ON CONFLICT(snapshot_time,alert_id) DO UPDATE SET acknowledged=true,updated_at=now()",
        [body.snapshotTime, body.alertId],
      );
    else
      await client.query(
        "INSERT INTO operational_actions(snapshot_time,alert_id,task_status) VALUES($1,$2,$3) ON CONFLICT(snapshot_time,alert_id) DO UPDATE SET task_status=excluded.task_status,updated_at=now()",
        [body.snapshotTime, body.alertId, body.status],
      );
    const result = await readDashboard(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
