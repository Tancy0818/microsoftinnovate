import type {
  DashboardData,
  Patient,
  PatientStage,
  Scenario,
  TriageLevel,
} from "../types/dashboard.ts";
import { isWaiting } from "../utils/calculateMetrics.ts";
import { generateAlerts } from "../utils/alertRules.ts";
const areaNames = [
  "Triage",
  "Waiting Area",
  "Resuscitation",
  "Examination",
  "Observation",
  "Boarding",
];
const capacities = [6, 24, 4, 18, 12, 10];
const distributions = {
  normal: [4, 12, 2, 12, 8, 5],
  high: [6, 24, 4, 17, 11, 10],
  stale: [5, 18, 3, 15, 10, 8],
};
const triages: TriageLevel[] = [
  "Yellow",
  "Green",
  "Yellow",
  "Orange",
  "Green",
  "Yellow",
  "Blue",
  "Orange",
  "Green",
  "Red",
];
export function createScenario(
  scenario: Scenario,
  now = Date.now(),
): DashboardData {
  const snapshot = now - (scenario === "stale" ? 27 * 60000 : 0);
  const updatedAt = new Date(snapshot).toISOString();
  const patients: Patient[] = [];
  const occupied = distributions[scenario];
  const make = (area: string, index: number, overflowQueue = false) => {
    const id = patients.length + 1;
    const stage: PatientStage = overflowQueue
      ? "Awaiting Bed"
      : area === "Triage"
        ? index % 3 === 0
          ? "Registration"
          : "Triage"
        : area === "Waiting Area"
          ? "Waiting"
          : area === "Boarding"
            ? "Awaiting Bed"
            : area === "Observation"
              ? "Treatment"
              : area === "Resuscitation"
                ? "Treatment"
                : index % 5 === 0
                  ? "Discharge"
                  : index % 2 === 0
                    ? "Assessment"
                    : "Treatment";
    const triageLevel =
      area === "Resuscitation"
        ? "Red"
        : area === "Waiting Area" && scenario === "normal"
          ? (["Yellow", "Green", "Blue"] as TriageLevel[])[index % 3]
          : triages[(id + 2) % triages.length];
    const queued = isWaiting({ stage } as Patient);
    const waitingMinutes =
      ["Red", "Orange"].includes(triageLevel) && scenario === "normal" && queued
        ? 4 + (id % 8)
        : stage === "Registration"
          ? 2 + index
          : stage === "Triage"
            ? 5 + index * 2
            : stage === "Awaiting Bed"
              ? (scenario === "high" ? 42 : 18) + index * 3
              : stage === "Waiting"
                ? (scenario === "high" ? 19 : 5) + ((index * 7) % 55)
                : 8 + ((id * 3) % 25);
    const elapsed = queued
      ? waitingMinutes
      : waitingMinutes + 25 + ((id * 7) % 80);
    patients.push({
      id: `ED-${String(2400 + id)}`,
      arrivalTime: new Date(snapshot - elapsed * 60000).toISOString(),
      triageLevel,
      stage,
      area,
      waitingMinutes,
      stageMinutes:
        stage === "Registration"
          ? elapsed
          : Math.max(1, Math.floor(elapsed * 0.6)),
      stageStartedAt: new Date(
        snapshot -
          (stage === "Registration"
            ? elapsed
            : Math.max(1, Math.floor(elapsed * 0.6))) *
            60000,
      ).toISOString(),
      assignedBed:
        !overflowQueue && !["Triage", "Waiting Area"].includes(area)
          ? `${area.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(2, "0")}`
          : undefined,
      lastUpdated: updatedAt,
      status:
        ["Red", "Orange"].includes(triageLevel) && queued && waitingMinutes > 15
          ? "Priority"
          : queued && waitingMinutes > 30
            ? "Delayed"
            : "Stable",
    });
  };
  areaNames.forEach((area, i) => {
    for (let j = 0; j < occupied[i]; j++) make(area, j);
  });
  if (scenario !== "normal") {
    for (let i = 0; i < (scenario === "high" ? 3 : 1); i++)
      make("Observation", i, true);
  }
  const areas = areaNames.map((area, i) => ({
    area,
    staffedCapacity: capacities[i],
    occupied: occupied[i],
    waiting: patients.filter((p) => p.area === area && isWaiting(p)).length,
    staffOnDuty: [3, 2, 4, 8, 5, 3][i],
  }));
  const history = Array.from({ length: 12 }, (_, i) => ({
    hour: new Date(snapshot - (11 - i) * 3600000).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: undefined,
    }),
    arrivals: (scenario === "high"
      ? [8, 11, 9, 13, 16, 12, 18, 20, 17, 22, 24, 21]
      : scenario === "stale"
        ? [6, 8, 7, 10, 9, 12, 10, 13, 11, 14, 15, 16]
        : [5, 7, 6, 8, 10, 7, 11, 9, 8, 10, 9, 8])[i],
    departures: (scenario === "high"
      ? [7, 8, 10, 9, 12, 11, 14, 16, 15, 15, 17, 15]
      : scenario === "stale"
        ? [6, 7, 8, 8, 10, 10, 11, 10, 12, 11, 12, 13]
        : [5, 6, 7, 7, 9, 8, 10, 10, 8, 9, 10, 8])[i],
  }));
  const partial = { scenario, patients, areas, history, updatedAt };
  const alerts = generateAlerts(partial);
  return {
    ...partial,
    alerts,
    tasks: alerts.map((a, i) => ({
      id: `task-${a.id}`,
      description:
        a.id === "beds"
          ? "Confirm additional staffed beds"
          : a.id === "acuity"
            ? "Review priority queue and staffing"
            : a.id === "observation"
              ? "Review observation transfers"
              : a.id === "arrivals"
                ? "Coordinate patient departures"
                : a.id === "stale"
                  ? "Investigate delayed data feed"
                  : "Review shift capacity",
      relatedAlertId: a.id,
      assignedRole:
        a.id === "stale"
          ? "IT operations"
          : i % 2
            ? "Nurse in charge"
            : "ED coordinator",
      priority:
        a.severity === "Critical"
          ? "High"
          : a.severity === "Warning"
            ? "Medium"
            : "Low",
      status: "Open",
    })),
  };
}
