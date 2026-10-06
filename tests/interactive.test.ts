import test from "node:test";
import assert from "node:assert/strict";
import {
  currentStageStart,
  type InteractiveVisit,
} from "../src/types/interactive.ts";
test("triage or bed edits within one stage preserve time in stage", () => {
  const event = {
    triage: "Yellow" as const,
    areaId: "a",
    area: "Examination",
    bed: 1,
    recordedAt: "2026-10-01T02:00:00Z",
  };
  const visit: InteractiveVisit = {
    id: "DEMO-test",
    arrivalMethod: "Walk-in",
    arrivalTime: "2026-10-01T00:00:00Z",
    events: [
      {
        ...event,
        id: 3,
        stage: "Assessment",
        occurredAt: "2026-10-01T02:00:00Z",
      },
      {
        ...event,
        id: 2,
        stage: "Assessment",
        occurredAt: "2026-10-01T01:00:00Z",
      },
      { ...event, id: 1, stage: "Triage", occurredAt: "2026-10-01T00:00:00Z" },
    ],
  };
  assert.equal(currentStageStart(visit), "2026-10-01T01:00:00Z");
});
