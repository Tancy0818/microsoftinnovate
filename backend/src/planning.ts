import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getInteractive, readInteractive } from "./interactive.ts";
import {
  isDeparted,
  type InteractiveData,
} from "../../src/types/interactive.ts";
import type {
  PlannerSettings,
  PlanResult,
  PlanOption,
  Forecast,
} from "../../src/types/planner.ts";
import { trainForecast } from "./forecast.ts";

export const waiting = (s: string) =>
  ["Registration", "Triage", "Waiting"].includes(s);
export function fingerprint(data: InteractiveData) {
  return createHash("sha256")
    .update(JSON.stringify(data.visits.map((v) => [v.id, v.events[0]?.id])))
    .digest("hex");
}
export function validateSettings(
  value: unknown,
  data: InteractiveData,
): asserts value is PlannerSettings {
  const s = value as PlannerSettings;
  const beds = data.areas.filter((a) => a.bedArea);
  if (
    !s ||
    !Array.isArray(s.resources) ||
    s.resources.some((r) => !r || typeof r !== "object") ||
    s.resources.length !== beds.length ||
    new Set(s.resources.map((r) => r.areaId)).size !== beds.length ||
    !beds.some((a) => a.id === s.targetArea) ||
    !beds.some((a) => a.id === s.donorArea) ||
    s.targetArea === s.donorArea ||
    !["yes", "no", "unknown"].includes(s.wardReady) ||
    !Number.isInteger(s.transferCount) ||
    s.transferCount < 0 ||
    s.transferCount > 100 ||
    typeof s.verifiedAt !== "string" ||
    !Number.isFinite(Date.parse(s.verifiedAt)) ||
    Date.parse(s.verifiedAt) > Date.now() + 60000
  )
    throw new Error("INVALID_PLANNER");
  for (const r of s.resources) {
    const a = beds.find((a) => a.id === r.areaId);
    if (
      !a ||
      ![
        r.readyBeds,
        r.staff,
        r.bedsPerStaff,
        r.serviceMinutes,
        r.reserveStaff,
        r.minimumStaff,
      ].every(Number.isInteger) ||
      r.readyBeds < 0 ||
      r.readyBeds > a.capacity ||
      r.staff < 0 ||
      r.staff > 100 ||
      r.reserveStaff < 0 ||
      r.reserveStaff > 100 ||
      r.minimumStaff < 0 ||
      r.minimumStaff > r.staff ||
      r.bedsPerStaff < 1 ||
      r.bedsPerStaff > 10 ||
      r.serviceMinutes < 5 ||
      r.serviceMinutes > 480
    )
      throw new Error("INVALID_PLANNER");
  }
}
export function defaults(data: InteractiveData): PlannerSettings {
  const beds = data.areas.filter((a) => a.bedArea);
  return {
    resources: beds.map((a) => ({
      areaId: a.id,
      readyBeds: a.capacity,
      staff: 0,
      bedsPerStaff: 2,
      serviceMinutes: 60,
      reserveStaff: 0,
      minimumStaff: 0,
    })),
    targetArea:
      beds.find((a) => a.name === "Examination")?.id ?? beds[0]?.id ?? "",
    donorArea:
      beds.find((a) => a.name === "Observation")?.id ?? beds[1]?.id ?? "",
    wardReady: "unknown",
    transferCount: 0,
    verifiedAt: new Date(0).toISOString(),
  };
}
function random(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return (seed + 1) / 4294967297;
  };
}
const usable = (r: PlannerSettings["resources"][number]) =>
  Math.min(r.readyBeds, r.staff * r.bedsPerStaff);
export function compare(
  data: InteractiveData,
  settings: PlannerSettings,
  forecast: Forecast,
): PlanResult {
  const active = data.visits.filter((v) => !isDeparted(v.events[0].stage));
  const target = settings.resources.find(
    (r) => r.areaId === settings.targetArea,
  )!;
  const donor = settings.resources.find(
    (r) => r.areaId === settings.donorArea,
  )!;
  const boarders = active.filter(
    (v) =>
      v.events[0].areaId === target.areaId &&
      v.events[0].bed !== null &&
      v.events[0].stage === "Awaiting Bed",
  ).length;
  const transferCount = Math.min(boarders, settings.transferCount);
  const demand = forecast.points[0].expected;
  const options: PlanOption[] = [
    {
      id: "baseline",
      title: "Continue current arrangement",
      feasible: true,
      reason: "Comparison baseline; no resource change.",
      queue: 0,
      lower: 0,
      upper: 0,
      donorPenalty: 0,
    },
    {
      id: "reserve",
      title: "Activate reserve support",
      feasible:
        target.reserveStaff > 0 &&
        usable(target) <
          data.areas.find((a) => a.id === target.areaId)!.capacity,
      reason:
        "One qualified reserve staff member; open up to two additional ready spaces within the configured limit.",
      queue: 0,
      lower: 0,
      upper: 0,
      donorPenalty: 0,
    },
    {
      id: "redeploy",
      title: "Redeploy one qualified staff member",
      feasible:
        donor.staff > donor.minimumStaff &&
        usable({ ...donor, staff: donor.staff - 1 }) >=
          data.areas.find((a) => a.id === donor.areaId)!.occupied,
      reason:
        "Preserve donor minimum staffing and coverage of currently occupied spaces. Assumes transferable skills are confirmed.",
      queue: 0,
      lower: 0,
      upper: 0,
      donorPenalty: 0,
    },
    {
      id: "transfer",
      title: "Complete approved ward transfers",
      feasible: transferCount > 0 && settings.wardReady === "yes",
      reason:
        settings.wardReady === "yes"
          ? `${transferCount} eligible, bed-occupying patients modelled; clinical approval and transport must be confirmed.`
          : "Requires eligible patients and confirmation of ward readiness.",
      queue: 0,
      lower: 0,
      upper: 0,
      donorPenalty: 0,
    },
  ];
  function simulate(id: string, rate: number, seed: number) {
    const resources = settings.resources.map((r) => ({ ...r }));
    const t = resources.find((r) => r.areaId === target.areaId)!,
      d = resources.find((r) => r.areaId === donor.areaId)!;
    if (id === "reserve") {
      t.staff++;
      t.readyBeds = Math.min(
        data.areas.find((a) => a.id === t.areaId)!.capacity,
        t.readyBeds + 2,
      );
    }
    if (id === "redeploy") {
      t.staff++;
      d.staff--;
    }
    let total = 0,
      donorQueue = 0;
    for (const [index, r] of resources.entries()) {
      const rand = random(seed + index * 73013);
      const patients = active.filter((v) => v.events[0].areaId === r.areaId);
      const blocked =
        patients.filter(
          (v) =>
            v.events[0].bed !== null && v.events[0].stage === "Awaiting Bed",
        ).length -
        (id === "transfer" && r.areaId === target.areaId ? transferCount : 0);
      const servers = Math.max(0, usable(r) - blocked);
      const occupied = patients.filter(
        (v) => v.events[0].bed !== null && v.events[0].stage !== "Awaiting Bed",
      ).length;
      let queue = patients.filter((v) => waiting(v.events[0].stage)).length;
      if (r.areaId === target.areaId)
        queue += active.filter(
          (v) =>
            waiting(v.events[0].stage) &&
            !resources.some((x) => x.areaId === v.events[0].areaId),
        ).length;
      // Service completion frees a modelled treatment slot, not a real patient record.
      const events: { time: number; arrival: boolean }[] = [];
      let busy = Math.min(servers, occupied);
      queue += Math.max(0, occupied - servers);
      const duration = () => -Math.log(rand()) * r.serviceMinutes;
      for (let i = 0; i < busy; i++)
        events.push({ time: duration(), arrival: false });
      const fill = (time: number) => {
        while (queue > 0 && busy < servers) {
          queue--;
          busy++;
          events.push({ time: time + duration(), arrival: false });
        }
      };
      fill(0);
      if (r.areaId === target.areaId && rate > 0) {
        let at = (-Math.log(rand()) * 60) / rate;
        while (at <= 60) {
          events.push({ time: at, arrival: true });
          at += (-Math.log(rand()) * 60) / rate;
        }
      }
      while (events.length) {
        events.sort((a, b) => a.time - b.time);
        const event = events.shift()!;
        if (event.time > 60) break;
        if (event.arrival) queue++;
        else busy--;
        fill(event.time);
      }
      total += queue;
      if (r.areaId === donor.areaId) donorQueue = queue;
    }
    return { total, donorQueue };
  }
  const mean = (v: number[]) =>
    Math.round((v.reduce((s, n) => s + n, 0) / v.length) * 10) / 10;
  const score = (id: string, rate = demand) => {
    const samples = Array.from({ length: 200 }, (_, i) =>
      simulate(id, rate, 17001 + i * 997),
    );
    const sorted = samples.map((x) => x.total).sort((a, b) => a - b);
    return {
      queue: mean(sorted),
      lower: sorted[19],
      upper: sorted[179],
      donor: mean(samples.map((x) => x.donorQueue)),
    };
  };
  const baseline = score("baseline");
  for (const option of options) {
    if (!option.feasible) continue;
    const result = score(option.id);
    Object.assign(option, {
      queue: result.queue,
      lower: result.lower,
      upper: result.upper,
      donorPenalty: Math.max(
        0,
        Math.round((result.donor - baseline.donor) * 10) / 10,
      ),
    });
  }
  const ranked = options
    .filter((o) => o.feasible && o.donorPenalty === 0)
    .sort((a, b) => a.queue - b.queue);
  const verification: string[] = [];
  if (settings.wardReady === "unknown" && transferCount > 0) {
    const possible = score("transfer");
    if (possible.queue + 0.5 < ranked[0].queue)
      verification.push(
        "Confirm ward readiness: completing the configured transfers could change the leading option.",
      );
  }
  const winner = ranked[0];
  const lowWinner = ranked
    .map((o) => ({
      id: o.id,
      value: score(o.id, forecast.points[0].lower).queue,
    }))
    .sort((a, b) => a.value - b.value)[0];
  const highWinner = ranked
    .map((o) => ({
      id: o.id,
      value: score(o.id, forecast.points[0].upper).queue,
    }))
    .sort((a, b) => a.value - b.value)[0];
  if (lowWinner.id !== highWinner.id)
    verification.push(
      "The leading option changes across demand assumptions. Review both low and high demand before choosing.",
    );
  if (Date.parse(data.asOf) - Date.parse(settings.verifiedAt) > 30 * 60000)
    verification.push(
      "Resource assumptions are over 30 minutes old. Verify and save availability before acting.",
    );
  if (forecast.stale)
    verification.push(
      "Demand training data is historical. These are scenario estimates, not a validated live forecast.",
    );
  const capacity = settings.resources.map((r) => {
    const a = data.areas.find((a) => a.id === r.areaId)!;
    return {
      areaId: r.areaId,
      name: a.name,
      physical: a.capacity,
      usable: usable(r),
      occupied: a.occupied,
      constraint:
        r.staff * r.bedsPerStaff < r.readyBeds
          ? "Staff availability"
          : r.readyBeds < a.capacity
            ? "Space readiness"
            : "Configured bed limit",
    };
  });
  if (capacity.some((a) => a.occupied > a.usable))
    verification.push(
      "Configured usable capacity is below occupied beds. Resolve the resource mismatch before trusting a ranking.",
    );
  return {
    options,
    recommendation:
      verification.length ||
      winner.id === "baseline" ||
      baseline.queue - winner.queue < 0.5
        ? null
        : winner.id,
    verification,
    capacity,
    startingQueue: active.filter((v) => waiting(v.events[0].stage)).length,
    active: active.length,
    expectedArrivals: demand,
    assumptions: [
      "60-minute discrete-event scenario; 200 seeded replications per feasible action. Bands show the central 80% of simulation outcomes, not a clinical guarantee.",
      "All future arrivals enter the selected target area. Exponential service durations use coordinator inputs; other areas receive no new arrivals. Donor effects may be underestimated.",
      "Treatment completion releases a simulated slot. Diagnostics, admission probability, acuity-specific routing and staff breaks are not modelled.",
      "Transfer candidates are capped by current bed-occupying Awaiting Bed records. No patient or staff assignment is changed by simulation.",
      "Configured bed limits come from existing area capacities, not a surveyed physical inventory. Staffing, skills and service durations require local validation.",
    ],
  };
}
async function forecastFor(pool: Pool, anchor: string) {
  const rows = (
    await pool.query(
      "SELECT hour_start,arrivals FROM department_hourly ORDER BY hour_start",
    )
  ).rows;
  return trainForecast(
    rows.map((r) => ({
      time: r.hour_start.toISOString(),
      arrivals: r.arrivals,
    })),
    anchor,
  );
}
export async function getPlanner(pool: Pool) {
  const data = await getInteractive(pool);
  const stored = (
    await pool.query("SELECT settings,version FROM planner_settings WHERE id=1")
  ).rows[0];
  const runs = (
    await pool.query(
      "SELECT * FROM planner_runs ORDER BY created_at DESC LIMIT 20",
    )
  ).rows;
  return {
    settings: stored?.settings ?? defaults(data),
    version: stored?.version ?? 0,
    forecast: await forecastFor(pool, data.asOf),
    runs,
    asOf: data.asOf,
    areas: data.areas,
  };
}
export async function writePlanner(pool: Pool, body: Record<string, unknown>) {
  const data = await getInteractive(pool);
  if (body.kind === "settings") {
    validateSettings(body.settings, data);
    if (!Number.isInteger(body.version)) throw new Error("INVALID_PLANNER");
    const settings = { ...body.settings, verifiedAt: new Date().toISOString() };
    const result = await pool.query(
      `INSERT INTO planner_settings(id,settings,version) SELECT 1,$1,1 WHERE $2=0
      ON CONFLICT(id) DO UPDATE SET settings=$1,version=planner_settings.version+1,updated_at=now() WHERE planner_settings.version=$2 RETURNING version`,
      [settings, body.version],
    );
    // UPDATE for existing versions (INSERT SELECT has no row when version > 0).
    if (!result.rowCount) {
      const updated = await pool.query(
        "UPDATE planner_settings SET settings=$1,version=version+1,updated_at=now() WHERE id=1 AND version=$2 RETURNING version",
        [settings, body.version],
      );
      if (!updated.rowCount) throw new Error("PLANNER_CONFLICT");
    }
  } else if (body.kind === "compare") {
    const stored = (
      await pool.query(
        "SELECT settings,version FROM planner_settings WHERE id=1",
      )
    ).rows[0];
    if (!stored || body.version !== stored.version)
      throw new Error("PLANNER_CONFLICT");
    validateSettings(stored.settings, data);
    const forecast = await forecastFor(pool, data.asOf);
    if (!forecast) throw new Error("FORECAST_UNAVAILABLE");
    const result = compare(data, stored.settings, forecast);
    await pool.query(
      "INSERT INTO planner_runs(id,settings,result,forecast,source_fingerprint) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), stored.settings, result, forecast, fingerprint(data)],
    );
  } else if (body.kind === "status") {
    if (
      typeof body.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body.id,
      ) ||
      !["started", "completed", "cancelled"].includes(String(body.status)) ||
      typeof body.note !== "string" ||
      body.note.length > 1000
    )
      throw new Error("INVALID_PLANNER");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(7234092)");
      const currentData = await readInteractive(client);
      const run = (
        await client.query(
          "SELECT * FROM planner_runs WHERE id=$1 FOR UPDATE",
          [body.id],
        )
      ).rows[0];
      if (
        !run ||
        !(
          (run.status === "compared" &&
            ["started", "cancelled"].includes(String(body.status))) ||
          (run.status === "started" &&
            ["completed", "cancelled"].includes(String(body.status)))
        )
      )
        throw new Error("PLANNER_CONFLICT");
      if (body.status === "started") {
        const option = (run.result as PlanResult).options.find(
          (o) => o.id === body.selected,
        );
        if (!option?.feasible || body.confirmed !== true)
          throw new Error("INVALID_PLANNER");
        const version = (
          await client.query(
            "SELECT settings FROM planner_settings WHERE id=1 FOR SHARE",
          )
        ).rows[0]?.settings;
        if (
          run.source_fingerprint !== fingerprint(currentData) ||
          Date.now() - Date.parse(run.created_at) > 10 * 60000 ||
          JSON.stringify(version) !== JSON.stringify(run.settings)
        )
          throw new Error("PLANNER_CONFLICT");
      }
      const active = currentData.visits.filter(
        (v) => !isDeparted(v.events[0].stage),
      );
      const outcome =
        body.status === "started"
          ? null
          : {
              active: active.length,
              queue: active.filter((v) => waiting(v.events[0].stage)).length,
              observedAt: currentData.asOf,
              elapsedMinutes: run.started_at
                ? Math.round(
                    (Date.parse(currentData.asOf) -
                      Date.parse(run.started_at)) /
                      6000,
                  ) / 10
                : 0,
              note: body.note,
            };
      await client.query(
        `UPDATE planner_runs SET status=$2,selected=CASE WHEN $2='started' THEN $3 ELSE selected END,
        started_at=CASE WHEN $2='started' THEN now() ELSE started_at END,completed_at=CASE WHEN $2 IN ('completed','cancelled') THEN now() ELSE NULL END,outcome=$4 WHERE id=$1`,
        [body.id, body.status, body.selected ?? null, outcome],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } else throw new Error("INVALID_PLANNER");
  return getPlanner(pool);
}
