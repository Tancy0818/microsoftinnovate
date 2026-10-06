import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  interactiveTriages,
  nextStages,
  isDeparted,
  type InteractiveStage,
  type InteractiveData,
} from "../../src/types/interactive.ts";

export async function readInteractive(
  client: PoolClient,
): Promise<InteractiveData> {
  const asOf = (
    await client.query("SELECT clock_timestamp() AS now")
  ).rows[0].now.toISOString();
  const visits = (
    await client.query(
      "SELECT * FROM interactive_visits ORDER BY arrival_time DESC,id",
    )
  ).rows;
  const events = (
    await client.query(
      "SELECT e.*,a.area_name FROM interactive_events e JOIN areas a USING(area_id) ORDER BY e.id DESC",
    )
  ).rows;
  const areas = (await client.query("SELECT * FROM areas ORDER BY area_id"))
    .rows;
  const eventsByVisit = new Map<string, typeof events>();
  for (const event of events) {
    const group = eventsByVisit.get(event.visit_id) ?? [];
    group.push(event);
    eventsByVisit.set(event.visit_id, group);
  }
  const mapped = visits.map((v) => ({
    id: v.id,
    arrivalTime: v.arrival_time.toISOString(),
    arrivalMethod: v.arrival_method,
    events: (eventsByVisit.get(v.id) ?? []).map((e) => ({
      id: Number(e.id),
      occurredAt: e.occurred_at.toISOString(),
      recordedAt: e.recorded_at.toISOString(),
      stage: e.stage,
      triage: e.triage,
      areaId: e.area_id,
      area: e.area_name,
      bed: e.bed_number,
      destination: e.destination,
    })),
  }));
  return {
    asOf,
    visits: mapped,
    areas: areas.map((a) => ({
      id: a.area_id,
      name: a.area_name,
      capacity: a.staffed_capacity,
      bedArea: Boolean(a.is_bed_area),
      occupied: mapped.filter((v) => {
        const e = v.events[0];
        return (
          e && !isDeparted(e.stage) && e.areaId === a.area_id && e.bed !== null
        );
      }).length,
    })),
  };
}
export async function getInteractive(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data = await readInteractive(client);
    await client.query("COMMIT");
    return data;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function writeInteractive(
  pool: Pool,
  body: Record<string, unknown>,
) {
  const invalid = () => {
    throw new Error("INVALID_PATIENT");
  };
  if (body.kind !== "register" && body.kind !== "event") invalid();
  if (
    typeof body.triage !== "string" ||
    !interactiveTriages.includes(
      body.triage as (typeof interactiveTriages)[number],
    ) ||
    typeof body.areaId !== "string"
  )
    invalid();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize this small local demo's occupancy changes, including competing bed assignments.
    await client.query("SELECT pg_advisory_xact_lock(7234092)");
    const now = (await client.query("SELECT clock_timestamp() AS now")).rows[0]
      .now;
    const area = (
      await client.query("SELECT * FROM areas WHERE area_id=$1", [body.areaId])
    ).rows[0];
    if (!area) invalid();
    if (body.kind === "register") {
      if (
        typeof body.requestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          body.requestId,
        ) ||
        typeof body.arrivalTime !== "string" ||
        !Number.isFinite(Date.parse(body.arrivalTime)) ||
        Date.parse(body.arrivalTime) > now.getTime() ||
        Date.parse(body.arrivalTime) < now.getTime() - 30 * 86400000 ||
        typeof body.arrivalMethod !== "string" ||
        !["Walk-in", "Ambulance", "Referral"].includes(body.arrivalMethod) ||
        area.is_bed_area
      )
        invalid();
      const existing = (
        await client.query(
          "SELECT * FROM interactive_visits WHERE request_id=$1",
          [body.requestId],
        )
      ).rows[0];
      if (!existing) {
        const id = `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`;
        await client.query(
          "INSERT INTO interactive_visits(id,request_id,arrival_time,arrival_method) VALUES($1,$2,$3,$4)",
          [id, body.requestId, body.arrivalTime, body.arrivalMethod],
        );
        await client.query(
          "INSERT INTO interactive_events(visit_id,occurred_at,stage,triage,area_id) VALUES($1,$2,$3,$4,$5)",
          [id, body.arrivalTime, "Registration", body.triage, body.areaId],
        );
      }
    } else {
      if (
        typeof body.patientId !== "string" ||
        !Number.isInteger(body.expectedId) ||
        typeof body.stage !== "string" ||
        !(body.stage in nextStages)
      )
        invalid();
      const latest = (
        await client.query(
          "SELECT * FROM interactive_events WHERE visit_id=$1 ORDER BY id DESC LIMIT 1",
          [body.patientId],
        )
      ).rows[0];
      if (!latest) invalid();
      if (Number(latest.id) !== body.expectedId)
        throw new Error("PATIENT_CONFLICT");
      if (
        !nextStages[latest.stage as InteractiveStage].includes(
          body.stage as InteractiveStage,
        )
      )
        invalid();
      if (
        ["Waiting", "Assessment", "Treatment", "Awaiting Bed"].includes(
          String(body.stage),
        ) &&
        body.triage === "Not assessed"
      )
        invalid();
      const destination =
        typeof body.destination === "string" ? body.destination.trim() : "";
      if (
        destination.length > 120 ||
        (["Admitted", "Transferred"].includes(String(body.stage)) &&
          !destination)
      )
        invalid();
      const departed = isDeparted(body.stage as InteractiveStage);
      const bed = departed ? null : body.bed;
      if (
        bed !== null &&
        (!Number.isInteger(bed) ||
          Number(bed) < 1 ||
          !area.is_bed_area ||
          Number(bed) > area.staffed_capacity)
      )
        invalid();
      if (bed !== null) {
        const occupied = await client.query(
          `SELECT 1 FROM (SELECT DISTINCT ON (visit_id) * FROM interactive_events ORDER BY visit_id,id DESC) e WHERE visit_id<>$1 AND area_id=$2 AND bed_number=$3 AND stage NOT IN ('Discharged','Transferred','Admitted','Left before completion','Departed')`,
          [body.patientId, body.areaId, bed],
        );
        if (occupied.rowCount) throw new Error("BED_OCCUPIED");
      }
      await client.query(
        "INSERT INTO interactive_events(visit_id,occurred_at,stage,triage,area_id,bed_number,destination) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          body.patientId,
          now,
          body.stage,
          body.triage,
          body.areaId,
          bed,
          ["Awaiting Bed", "Admitted", "Transferred"].includes(
            String(body.stage),
          )
            ? destination || null
            : null,
        ],
      );
    }
    const data = await readInteractive(client);
    await client.query("COMMIT");
    return data;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
