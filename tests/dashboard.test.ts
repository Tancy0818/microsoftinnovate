import { test } from "node:test";
import assert from "node:assert/strict";
import { createScenario } from "../src/data/scenarios.ts";
import {
  calculateMetrics,
  flowByStage,
  freshness,
  isWaiting,
} from "../src/utils/calculateMetrics.ts";
import { generateAlerts } from "../src/utils/alertRules.ts";
import type { Scenario } from "../src/types/dashboard.ts";
test("stage durations are distinct from elapsed arrival time and missing data stays unknown", () => {
  const p = createScenario(
    "high",
    Date.parse("2026-09-27T18:30:00Z"),
  ).patients.find((p) => p.stage === "Awaiting Bed")!;
  const rows = flowByStage([{ ...p, waitingMinutes: 100, stageMinutes: 12 }]);
  assert.equal(rows.find((r) => r.stage === "Awaiting Bed")?.delay, 12);
  assert.equal(
    flowByStage([{ ...p, stageMinutes: undefined }]).find(
      (r) => r.stage === "Awaiting Bed",
    )?.delay,
    null,
  );
  assert(flowByStage([]).every((r) => r.delay === null));
});
for (const scenario of ["normal", "high", "stale"] as Scenario[]) {
  test(`${scenario}: patient, capacity and flow totals agree`, () => {
    const now = Date.now();
    const d = createScenario(scenario, now);
    const m = calculateMetrics(d);
    assert.deepEqual(d, createScenario(scenario, now));
    assert.equal(m.active, d.patients.length);
    assert.equal(m.waiting, d.patients.filter(isWaiting).length);
    assert.equal(
      flowByStage(d.patients).reduce((n, s) => n + s.count, 0),
      m.active,
    );
    assert.equal(new Set(d.patients.map((p) => p.id)).size, m.active);
    assert.equal(d.patients.filter((p) => p.assignedBed).length, m.occupied);
    for (const a of d.areas) {
      assert.ok(a.occupied <= a.staffedCapacity);
      assert.equal(
        a.waiting,
        d.patients.filter((p) => p.area === a.area && isWaiting(p)).length,
      );
      if (!["Triage", "Waiting Area"].includes(a.area))
        assert.equal(
          a.occupied,
          d.patients.filter((p) => p.area === a.area && p.assignedBed).length,
        );
    }
    for (const p of d.patients) {
      const elapsed =
        (Date.parse(p.lastUpdated) - Date.parse(p.arrivalTime)) / 60000;
      assert.ok(elapsed >= p.waitingMinutes);
      if (isWaiting(p)) assert.equal(elapsed, p.waitingMinutes);
    }
    assert.deepEqual(d.alerts, generateAlerts(d));
    for (const t of d.tasks)
      assert.ok(d.alerts.some((a) => a.id === t.relatedAlertId));
  });
}
test("normal scenario is stable; high demand triggers capacity, acuity and flow alerts", () => {
  const normal = createScenario("normal");
  const high = createScenario("high");
  assert.ok(normal.alerts.every((a) => a.severity === "Information"));
  assert.ok(calculateMetrics(normal).occupancy < 85);
  assert.equal(calculateMetrics(high).pressure, "Critical");
  for (const id of ["beds", "acuity", "arrivals", "observation"])
    assert.ok(high.alerts.some((a) => a.id === id));
});
test("freshness boundaries and stale refresh do not imply live data", () => {
  const now = Date.now();
  const iso = (minutes: number) =>
    new Date(now - minutes * 60000).toISOString();
  assert.equal(freshness(iso(0), now).status, "Live");
  assert.equal(freshness(iso(5), now).status, "Delayed");
  assert.equal(freshness(iso(20), now).status, "Delayed");
  assert.equal(freshness(iso(21), now).status, "Stale");
  for (const instant of [now, now + 60000]) {
    const d = createScenario("stale", instant);
    assert.equal(freshness(d.updatedAt, instant).status, "Stale");
    assert.ok(d.alerts.some((a) => a.id === "stale"));
  }
});
