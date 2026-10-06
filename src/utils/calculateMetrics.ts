import type {
  DashboardData,
  Patient,
  PatientStage,
} from "../types/dashboard.ts";
export const stages: PatientStage[] = [
  "Registration",
  "Triage",
  "Waiting",
  "Assessment",
  "Treatment",
  "Awaiting Bed",
  "Discharge",
];
export const isWaiting = (p: Patient) =>
  ["Registration", "Triage", "Waiting", "Awaiting Bed"].includes(p.stage);
export const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0;
};
export const flowByStage = (patients: Patient[]) =>
  stages.map((stage) => {
    const group = patients.filter((p) => p.stage === stage);
    return {
      stage,
      count: group.length,
      delay:
        group.length && group.every((p) => p.stageMinutes !== undefined)
          ? Math.round(median(group.map((p) => p.stageMinutes!)))
          : null,
    };
  });
export function calculateMetrics(
  data: Pick<DashboardData, "patients" | "areas" | "history">,
) {
  const waiting = data.patients.filter(isWaiting);
  const beds = data.areas.filter((a) =>
    ["Resuscitation", "Examination", "Observation", "Boarding"].includes(
      a.area,
    ),
  );
  const occupied = beds.reduce((n, a) => n + a.occupied, 0),
    capacity = beds.reduce((n, a) => n + a.staffedCapacity, 0);
  const occupancy = Math.round((occupied / capacity) * 100);
  const pressure =
    occupancy >= 95 || waiting.length >= 35
      ? "Critical"
      : occupancy >= 85 || waiting.length >= 25
        ? "High"
        : occupancy >= 75 || waiting.length >= 18
          ? "Moderate"
          : "Low";
  const lastHour = data.history.at(-1)!;
  return {
    active: data.patients.length,
    waiting: waiting.length,
    average: Math.round(
      waiting.reduce((n, p) => n + p.waitingMinutes, 0) / (waiting.length || 1),
    ),
    occupied,
    capacity,
    occupancy,
    pressure,
    netChange: lastHour.arrivals - lastHour.departures,
    imbalance: data.history.slice(-3).every((h) => h.arrivals > h.departures),
  };
}
export const freshness = (updatedAt: string, now = Date.now()) => {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(updatedAt).getTime()) / 60000),
  );
  return {
    minutes,
    status: minutes > 20 ? "Stale" : minutes >= 5 ? "Delayed" : "Live",
  };
};
