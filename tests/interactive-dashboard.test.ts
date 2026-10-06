import test from "node:test";
import assert from "node:assert/strict";
import { interactiveDashboard } from "../src/utils/interactiveDashboard.ts";
import { calculateMetrics } from "../src/utils/calculateMetrics.ts";
import type { InteractiveData } from "../src/types/interactive.ts";
test("saved registration, bed assignment and discharge map to the main dashboard", () => {
  const input: InteractiveData = {
    asOf: "2026-10-01T06:45:00Z",
    areas: [
      {
        id: "a",
        name: "Examination",
        capacity: 18,
        bedArea: true,
        occupied: 0,
      },
      {
        id: "b",
        name: "Observation",
        capacity: 12,
        bedArea: true,
        occupied: 0,
      },
    ],
    visits: [
      {
        id: "DEMO-test",
        arrivalTime: "2026-10-01T06:10:00Z",
        arrivalMethod: "Walk-in",
        events: [
          {
            id: 1,
            occurredAt: "2026-10-01T06:10:00Z",
            recordedAt: "2026-10-01T06:10:00Z",
            stage: "Registration",
            triage: "Not assessed",
            areaId: "a",
            area: "Examination",
            bed: null,
          },
        ],
      },
    ],
  };
  let dashboard = interactiveDashboard(input);
  assert.equal(dashboard.patients[0].triageLevel, "Not assessed");
  assert.equal(calculateMetrics(dashboard).active, 1);
  assert.equal(calculateMetrics(dashboard).waiting, 1);
  assert.equal(
    dashboard.history.reduce((n, h) => n + h.arrivals, 0),
    1,
  );
  input.visits[0].events.unshift({
    ...input.visits[0].events[0],
    id: 2,
    stage: "Assessment",
    triage: "Yellow",
    bed: 1,
    occurredAt: "2026-10-01T06:40:00Z",
  });
  input.areas[0].occupied = 1;
  dashboard = interactiveDashboard(input);
  assert.equal(calculateMetrics(dashboard).occupied, 1);
  assert.equal(calculateMetrics(dashboard).waiting, 0);
  assert.equal(dashboard.patients[0].stageMinutes, 5);
  input.visits[0].events.unshift({
    ...input.visits[0].events[0],
    id: 3,
    stage: "Discharged",
    bed: null,
    occurredAt: "2026-10-01T06:44:00Z",
  });
  input.areas[0].occupied = 0;
  dashboard = interactiveDashboard(input);
  assert.equal(calculateMetrics(dashboard).active, 0);
  assert.equal(calculateMetrics(dashboard).occupancy, 0);
  assert.equal(
    dashboard.history.reduce((n, h) => n + h.departures, 0),
    1,
  );
});
