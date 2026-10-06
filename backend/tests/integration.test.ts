import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../src/migrate.ts";
import { importDataset } from "../src/import-dataset.ts";
import { createApi } from "../src/app.ts";
import { calculateMetrics } from "../../src/utils/calculateMetrics.ts";

test("PostgreSQL API lifecycle: empty, import, reconciliation, persistence, failure", async () => {
  const secret = JSON.parse(
    await readFile(
      new URL("../../.local/database-credentials.json", import.meta.url),
      "utf8",
    ),
  );
  const admin = new Pool({
    connectionString: `postgresql://postgres:${secret.admin}@127.0.0.1:5433/postgres`,
  });
  const name = `acuity_test_${Date.now()}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const pool = new Pool({
    connectionString: `postgresql://postgres:${secret.admin}@127.0.0.1:5433/${name}`,
  });
  const server = createApi(pool);
  let ended = false;
  try {
    await migrate(pool);
    await migrate(pool);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}`;
    const get = async () => {
      const response = await fetch(url + "/api/dashboard");
      assert.equal(response.status, 200);
      return response.json();
    };
    assert.equal((await get()).state, "empty");
    assert.match(await importDataset(pool), /successfully/);
    const result = await get();
    assert.equal(result.state, "ready");
    assert.equal(result.data.patients.length, 9);
    const m = calculateMetrics(result.data);
    assert.equal(m.active, result.summary.active);
    assert.equal(m.waiting, result.summary.waiting);
    assert.equal(m.average, Math.round(result.summary.average));
    assert.equal(m.occupied, 6);
    assert.equal(m.capacity, 44);
    assert.equal(result.data.updatedAt, "2026-09-27T18:30:00.000Z");
    assert(!result.data.alerts.some((a: { id: string }) => a.id === "stale"));
    for (const p of result.data.patients) {
      assert.equal(
        p.stageMinutes,
        Math.round(
          (Date.parse(result.data.updatedAt) - Date.parse(p.stageStartedAt)) /
            60000,
        ),
      );
      assert(p.stageMinutes >= 0 && p.stageMinutes <= p.waitingMinutes);
    }
    const transfer = result.data.patients.find(
      (p: { stage: string }) => p.stage === "Awaiting Bed",
    );
    assert(
      transfer,
      "Dataset must supply a transfer case for the presentation",
    );
    const followup = {
      snapshotTime: result.data.updatedAt,
      patientId: transfer.id,
      blocker: "Bed preparation",
      owner: "Bed management",
      status: "In Progress",
      note: "Synthetic test: bed preparation follow-up.",
      expectedId: 0,
    };
    const saveFollowup = (body: unknown, origin = "http://127.0.0.1:5173") =>
      fetch(url + "/api/followups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await saveFollowup(followup, "https://unrelated.example")).status,
      403,
    );
    assert.equal((await saveFollowup({ ...followup, note: " " })).status, 400);
    assert.equal(
      (await saveFollowup({ ...followup, patientId: "unknown" })).status,
      400,
    );
    assert.equal(
      (await saveFollowup({ ...followup, owner: "Unassigned" })).status,
      400,
    );
    assert.equal(
      (await saveFollowup({ ...followup, snapshotTime: "2020-01-01" })).status,
      409,
    );
    assert.equal((await saveFollowup(followup)).status, 200);
    const saved = (await get()).data.followups[0];
    assert.equal(saved.owner, "Bed management");
    assert.equal(
      (await saveFollowup(followup)).status,
      409,
      "Reject stale edits",
    );
    assert.equal(
      (
        await saveFollowup({
          ...followup,
          expectedId: saved.id,
          status: "Closed",
          note: "Coordination completed; patient movement unchanged.",
        })
      ).status,
      200,
    );
    const closed = await get();
    assert.equal(closed.data.followups.length, 2);
    assert.equal(closed.data.followups[0].status, "Closed");
    assert.deepEqual(
      closed.data.patients,
      result.data.patients,
      "Closing follow-up must not transfer patients",
    );
    const totals = (
      await pool.query(
        "SELECT sum(arrivals)::integer AS arrivals,sum(departures)::integer AS departures FROM reporting.department_hourly",
      )
    ).rows[0];
    assert.equal(totals.arrivals, 3015);
    assert.equal(totals.departures, 3006);
    const patch = (body: unknown, origin?: string) =>
      fetch(url + "/api/actions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify(body),
      });
    const alert = result.data.alerts[0];
    const action = {
      snapshotTime: result.data.updatedAt,
      alertId: alert.id,
      kind: "acknowledge",
    };
    assert.equal(
      (await patch(action, "https://unrelated.example")).status,
      403,
    );
    assert.equal(
      (await patch({ ...action, alertId: "'; DROP TABLE visits;--" })).status,
      400,
    );
    assert.equal(
      (await patch({ ...action, snapshotTime: "2026-01-01T00:00:00Z" })).status,
      409,
    );
    assert.equal((await patch(action)).status, 200);
    assert.equal((await get()).data.alerts[0].status, "Acknowledged");
    assert.equal(
      (await pool.query("SELECT acknowledged FROM operational_actions")).rows[0]
        .acknowledged,
      true,
    );
    await pool.query(
      "UPDATE department_hourly SET arrivals=departures+1 WHERE snapshot_time IN (SELECT snapshot_time FROM department_hourly ORDER BY snapshot_time DESC LIMIT 3)",
    );
    const changed = await get();
    const task = changed.data.tasks.find(
      (t: { relatedAlertId: string }) => t.relatedAlertId === "arrivals",
    );
    assert(task);
    {
      assert.equal(
        (
          await patch({
            ...action,
            alertId: task.relatedAlertId,
            kind: "task",
            status: "Completed",
          })
        ).status,
        200,
      );
      assert.equal((await get()).data.tasks[0].status, "Completed");
    }
    assert.match(await importDataset(pool), /Already imported/);
    assert.equal(
      (
        await pool.query(
          "SELECT acknowledged FROM operational_actions WHERE alert_id=$1",
          [alert.id],
        )
      ).rows[0].acknowledged,
      true,
    );
    const reporting = new Pool({
      connectionString: `postgresql://acuity_report:${secret.report}@127.0.0.1:5433/${name}`,
    });
    try {
      assert.equal(
        (
          await reporting.query(
            "SELECT count(*)::integer AS count FROM reporting.department_hourly",
          )
        ).rows[0].count,
        720,
      );
      await assert.rejects(
        reporting.query("UPDATE visits SET synthetic=1"),
        /permission denied/,
      );
    } finally {
      await reporting.end();
    }
    assert.equal(
      (await pool.query("SELECT count(*)::integer AS count FROM visits"))
        .rows[0].count,
      3015,
    );
    // Interactive entry is isolated from historical facts and preserves event history.
    const interactiveGet = async () =>
      (await fetch(url + "/api/interactive")).json();
    const interactivePost = (body: unknown, origin = "http://127.0.0.1:5173") =>
      fetch(url + "/api/interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(body),
      });
    const dailyTotals=(await pool.query("SELECT sum(arrivals)::int AS arrivals,sum(departures)::int AS departures FROM reporting.operational_daily")).rows[0];
    assert.deepEqual(dailyTotals,{arrivals:3015,departures:3006});
    const areaTotals=(await pool.query("SELECT sum(occupied)::int AS occupied,sum(staffed_capacity)::int AS capacity FROM reporting.operational_areas")).rows[0];
    assert.deepEqual(areaTotals,{occupied:6,capacity:44});
    const combined = await interactiveGet();
    assert.equal(combined.visits.length,3015);
    const baseline = (await pool.query("SELECT sum(active_count)::int AS active,sum(occupied_count)::int AS occupied FROM reporting.interactive_patients")).rows[0];
    assert.deepEqual(baseline,{active:9,occupied:6});
    const original = combined.visits.find((v: {id: string}) => v.id === "SYN-03009");
    assert.equal((await interactivePost({kind:"event",patientId:original.id,expectedId:original.events[0].id,stage:"Discharged",triage:original.events[0].triage,areaId:original.events[0].areaId,bed:null})).status,200);
    await pool.query("SELECT seed_operational_patients()");
    assert.equal((await pool.query("SELECT sum(active_count)::int AS active FROM reporting.interactive_patients")).rows[0].active,8);
    assert.equal((await get()).data.patients.length,9,"Historical snapshot remains intact");
    // Clear only the disposable test database ledger for the isolated entry scenarios below.
    await pool.query("DELETE FROM interactive_events");
    await pool.query("DELETE FROM interactive_visits");
    const initialInteractive = await interactiveGet();
    assert.equal(initialInteractive.visits.length, 0);
    const emptyReport = (
      await pool.query(
        "SELECT count(visit_id)::int AS entered, sum(active_count)::int AS active, max(staffed_beds)::int AS capacity FROM reporting.interactive_patients",
      )
    ).rows[0];
    assert.deepEqual(emptyReport, { entered: 0, active: 0, capacity: 44 });
    const initialArea = initialInteractive.areas.find(
      (a: { bedArea: boolean }) => !a.bedArea,
    );
    const bedArea = initialInteractive.areas.find(
      (a: { bedArea: boolean }) => a.bedArea,
    );
    const registration = {
      kind: "register",
      requestId: crypto.randomUUID(),
      arrivalTime: new Date(Date.now() - 600000).toISOString(),
      arrivalMethod: "Walk-in",
      triage: "Not assessed",
      areaId: initialArea.id,
    };
    assert.equal(
      (await interactivePost(registration, "https://unrelated.example")).status,
      403,
    );
    assert.equal(
      (
        await interactivePost({
          ...registration,
          arrivalTime: new Date(Date.now() + 86400000).toISOString(),
        })
      ).status,
      400,
    );
    assert.equal((await interactivePost(registration)).status, 200);
    assert.equal((await interactivePost(registration)).status, 200);
    let interactive = await interactiveGet();
    assert.equal(
      interactive.visits.length,
      1,
      "Retry must not duplicate a visit",
    );
    const first = interactive.visits[0];
    const movement = {
      kind: "event",
      patientId: first.id,
      expectedId: first.events[0].id,
      stage: "Triage",
      triage: "Yellow",
      areaId: initialArea.id,
      bed: null,
    };
    assert.equal(
      (await interactivePost({ ...movement, stage: "Treatment" })).status,
      400,
      "Reject skipped stages",
    );
    assert.equal((await interactivePost(movement)).status, 200);
    assert.equal(
      (await interactivePost(movement)).status,
      409,
      "Reject stale updates",
    );
    interactive = await interactiveGet();
    const assessment = {
      ...movement,
      expectedId: interactive.visits[0].events[0].id,
      stage: "Assessment",
      areaId: bedArea.id,
      bed: 1,
    };
    assert.equal(
      (await interactivePost({ ...assessment, triage: "Not assessed" })).status,
      400,
    );
    assert.equal(
      (await interactivePost({ ...assessment, bed: bedArea.capacity + 1 }))
        .status,
      400,
    );
    assert.equal((await interactivePost(assessment)).status, 200);
    interactive = await interactiveGet();
    assert.equal(
      interactive.areas.find((a: { id: string }) => a.id === bedArea.id)
        .occupied,
      1,
    );
    assert.equal(
      (
        await interactivePost({
          ...registration,
          requestId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    interactive = await interactiveGet();
    const second = interactive.visits.find(
      (v: { id: string }) => v.id !== first.id,
    );
    assert.equal(
      (
        await interactivePost({
          ...movement,
          patientId: second.id,
          expectedId: second.events[0].id,
          areaId: bedArea.id,
          bed: 1,
        })
      ).status,
      409,
      "Cannot double-book a bed",
    );
    const firstCurrent = interactive.visits.find(
      (v: { id: string }) => v.id === first.id,
    );
    assert.equal(
      (
        await interactivePost({
          ...assessment,
          expectedId: firstCurrent.events[0].id,
          stage: "Discharged",
        })
      ).status,
      200,
    );
    interactive = await interactiveGet();
    const discharged = interactive.visits.find(
      (v: { id: string }) => v.id === first.id,
    );
    assert.equal(discharged.events[0].bed, null);
    assert.equal(discharged.events.length, 4);
    assert.equal(
      interactive.areas.find((a: { id: string }) => a.id === bedArea.id)
        .occupied,
      0,
    );
    assert.equal(
      (
        await interactivePost({
          ...movement,
          expectedId: discharged.events[0].id,
        })
      ).status,
      400,
      "No updates after departure",
    );
    assert.equal(
      (await get()).data.patients.length,
      9,
      "Historical dataset remains untouched",
    );
    const reportCounts = (
      await pool.query(
        "SELECT count(visit_id)::int AS entered, sum(active_count)::int AS active,sum(waiting_count)::int AS waiting,sum(occupied_count)::int AS occupied,sum(departed_count)::int AS departed FROM reporting.interactive_patients",
      )
    ).rows[0];
    assert.deepEqual(reportCounts, {
      entered: 2,
      active: 1,
      waiting: 1,
      occupied: 0,
      departed: 1,
    });
    // Admission is a two-step process: boarding retains occupancy; ward departure releases it.
    const updateSecond = async (stage: string, destination = "") => {
      const d = await interactiveGet();
      const v = d.visits.find((v: { id: string }) => v.id === second.id);
      return interactivePost({
        ...movement,
        patientId: second.id,
        expectedId: v.events[0].id,
        stage,
        destination,
        areaId: bedArea.id,
        bed: 1,
      });
    };
    assert.equal((await updateSecond("Admitted", "Medical ward")).status, 400);
    assert.equal((await updateSecond("Triage")).status, 200);
    assert.equal((await updateSecond("Assessment")).status, 200);
    assert.equal(
      (await updateSecond("Awaiting Bed", "Medical ward")).status,
      200,
    );
    const boarding = (
      await pool.query(
        "SELECT * FROM reporting.interactive_patients WHERE visit_id=$1",
        [second.id],
      )
    ).rows[0];
    assert.equal(boarding.active_count, 1);
    assert.equal(boarding.occupied_count, 1);
    assert.equal(boarding.departed_count, 0);
    assert.equal((await updateSecond("Admitted", " ")).status, 400);
    assert.equal((await updateSecond("Admitted", "Medical ward")).status, 200);
    const admitted = (await interactiveGet()).visits.find(
      (v: { id: string }) => v.id === second.id,
    );
    assert.equal(admitted.events[0].destination, "Medical ward");
    assert.equal(admitted.events[0].bed, null);
    const admissionReport = (
      await pool.query(
        "SELECT * FROM reporting.interactive_patients WHERE visit_id=$1",
        [second.id],
      )
    ).rows[0];
    assert.equal(admissionReport.active_count, 0);
    assert.equal(admissionReport.occupied_count, 0);
    assert.equal(admissionReport.departed_count, 1);
    assert.equal((await updateSecond("Treatment")).status, 400);
    for (const stage of ["Transferred", "Left before completion"]) {
      const registered = await (
        await interactivePost({
          ...registration,
          requestId: crypto.randomUUID(),
          arrivalTime: new Date().toISOString(),
        })
      ).json();
      const patient = registered.visits[0];
      const body = {
        ...movement,
        patientId: patient.id,
        expectedId: patient.events[0].id,
        stage,
      };
      if (stage === "Transferred")
        assert.equal((await interactivePost(body)).status, 400);
      assert.equal(
        (
          await interactivePost({
            ...body,
            destination: stage === "Transferred" ? "Central Hospital" : "",
          })
        ).status,
        200,
      );
      const row = (
        await pool.query(
          "SELECT * FROM reporting.interactive_patients WHERE visit_id=$1",
          [patient.id],
        )
      ).rows[0];
      assert.equal(row.active_count, 0);
      assert.equal(row.departed_count, 1);
    }
    await pool.end();
    ended = true;
    const failure = await fetch(url + "/api/dashboard");
    assert.equal(failure.status, 503);
    assert.match((await failure.json()).error, /Database unavailable/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!ended) await pool.end();
    await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
});
