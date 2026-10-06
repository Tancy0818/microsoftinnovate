import test from "node:test";
import assert from "node:assert/strict";
import { trainForecast } from "../backend/src/forecast.ts";
import {
  compare,
  defaults,
  validateSettings,
} from "../backend/src/planning.ts";
import type { InteractiveData } from "../src/types/interactive.ts";

const rows = Array.from({ length: 720 }, (_, i) => ({
  time: new Date(Date.UTC(2026, 7, 29) + i * 3600000).toISOString(),
  arrivals: Math.round(5 + 3 * Math.sin((i * Math.PI) / 12)),
}));
test("forecast holds out future hours, validates continuity and has finite bounds", () => {
  assert.equal(trainForecast(rows.slice(0, 50), rows[0].time), null);
  assert.equal(
    trainForecast(
      rows.filter((_, i) => i !== 200),
      rows[0].time,
    ),
    null,
  );
  const f = trainForecast(rows, "2026-09-28T00:00:00Z")!;
  assert.equal(f.testHours, 144);
  assert.equal(f.points.length, 24);
  assert(
    f.points.every(
      (p) => p.lower >= 0 && p.lower <= p.expected && p.expected <= p.upper,
    ),
  );
  const changed = rows.map((r, i) =>
    i >= 576 ? { ...r, arrivals: r.arrivals + 20 } : r,
  );
  const other = trainForecast(changed, "2026-09-28T00:00:00Z")!;
  assert.equal(other.model, f.model);
  assert.equal(other.validationMae, f.validationMae);
  assert(other.testMae > f.testMae + 10);
});
const data: InteractiveData = {
  asOf: new Date().toISOString(),
  areas: [
    { id: "a", name: "Examination", capacity: 8, occupied: 0, bedArea: true },
    { id: "b", name: "Observation", capacity: 8, occupied: 0, bedArea: true },
  ],
  visits: [],
};
test("resource validation rejects malformed data, negative staffing and capacity overflow", () => {
  const s = defaults(data);
  validateSettings(s, data);
  assert.throws(
    () => validateSettings({ ...s, resources: [null, null] }, data),
    /INVALID_PLANNER/,
  );
  assert.throws(
    () =>
      validateSettings(
        { ...s, resources: s.resources.map((r) => ({ ...r, staff: -1 })) },
        data,
      ),
    /INVALID_PLANNER/,
  );
  assert.throws(
    () =>
      validateSettings(
        { ...s, resources: s.resources.map((r) => ({ ...r, readyBeds: 9 })) },
        data,
      ),
    /INVALID_PLANNER/,
  );
});
test("unconfigured capacity does not invent staff, impossible actions are excluded, runs reproduce", () => {
  const s = defaults(data),
    f = trainForecast(rows, data.asOf)!;
  const result = compare(data, s, f);
  assert(result.capacity.every((a) => a.usable === 0));
  assert(
    result.options.filter((o) => o.id !== "baseline").every((o) => !o.feasible),
  );
  assert.equal(result.recommendation, null);
  assert.deepEqual(compare(data, s, f), result);
  assert(result.verification.some((v) => v.includes("historical")));
});
test("reserve adds feasible capacity and does not invent a donor penalty", () => {
  const s = defaults(data);
  s.resources[0].staff = 1;
  s.resources[0].reserveStaff = 1;
  s.resources[1].staff = 1;
  s.resources[1].minimumStaff = 1;
  s.verifiedAt = data.asOf;
  const result = compare(data, s, trainForecast(rows, data.asOf)!);
  const reserve = result.options.find((o) => o.id === "reserve")!;
  assert(reserve.feasible);
  assert.equal(reserve.donorPenalty, 0);
  assert(!result.options.find((o) => o.id === "redeploy")!.feasible);
});

test("unknown ward readiness triggers a decision-sensitive verification request", () => {
  const snapshot: InteractiveData = {
    ...data,
    areas: data.areas.map((a) => ({ ...a, occupied: a.id === "a" ? 2 : 0 })),
    visits: Array.from({ length: 8 }, (_, i) => ({
      id: `fixture-${i}`,
      arrivalTime: data.asOf,
      arrivalMethod: "Walk-in",
      events: [
        {
          id: i + 1,
          occurredAt: data.asOf,
          recordedAt: data.asOf,
          stage: i < 2 ? "Awaiting Bed" : "Waiting",
          triage: "Yellow",
          areaId: "a",
          area: "Examination",
          bed: i < 2 ? i + 1 : null,
        },
      ],
    })),
  };
  const settings = defaults(snapshot);
  settings.resources.forEach((r) => {
    r.staff = 1;
    r.readyBeds = 2;
    r.minimumStaff = 1;
  });
  settings.transferCount = 2;
  settings.verifiedAt = data.asOf;
  const result = compare(snapshot, settings, trainForecast(rows, data.asOf)!);
  assert(
    result.verification.some((v) => v.startsWith("Confirm ward readiness")),
  );
  assert.equal(
    result.options.find((o) => o.id === "transfer")!.feasible,
    false,
  );
  const confirmed = compare(
    snapshot,
    { ...settings, wardReady: "yes" },
    trainForecast(rows, data.asOf)!,
  );
  assert(confirmed.options.find((o) => o.id === "transfer")!.feasible);
  assert(
    confirmed.options.find((o) => o.id === "transfer")!.queue <
      confirmed.options[0].queue,
  );
});
