import type { DashboardData, OperationalAlert } from "../types/dashboard.ts";
import { calculateMetrics, freshness, isWaiting } from "./calculateMetrics.ts";
export const thresholds = {
  occupancyWarning: 85,
  occupancyCritical: 95,
  highAcuityWait: 15,
  staleMinutes: 20,
};
export function generateAlerts(
  data: Pick<DashboardData, "patients" | "areas" | "history" | "updatedAt">,
  options: { historical?: boolean } = {},
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const add = (
    id: string,
    severity: OperationalAlert["severity"],
    title: string,
    affectedEntity: string,
    trigger: string,
    explanation: string,
    suggestedAction: string,
  ) =>
    alerts.push({
      id,
      severity,
      title,
      affectedEntity,
      trigger,
      explanation,
      suggestedAction,
      createdAt: data.updatedAt,
      status: "Open",
    });
  const m = calculateMetrics(data);
  if (m.occupancy >= thresholds.occupancyWarning)
    add(
      "beds",
      m.occupancy >= thresholds.occupancyCritical ? "Critical" : "Warning",
      "Staffed beds under pressure",
      "ED bed capacity",
      `Bed occupancy ≥ ${m.occupancy >= 95 ? 95 : 85}%`,
      `${m.occupied} of ${m.capacity} staffed beds are occupied (${m.occupancy}%).`,
      "Confirm additional staffed beds and review pending transfers.",
    );
  const priority = data.patients.filter(
    (p) =>
      ["Red", "Orange"].includes(p.triageLevel) &&
      isWaiting(p) &&
      p.waitingMinutes > thresholds.highAcuityWait,
  );
  if (priority.length)
    add(
      "acuity",
      "Critical",
      "High-acuity waiting limit exceeded",
      priority.map((p) => p.id).join(", "),
      "Red / Orange waiting > 15 minutes",
      `${priority.length} high-acuity patients have exceeded the configured operational waiting limit. Longest wait: ${Math.max(...priority.map((p) => p.waitingMinutes))} minutes.`,
      "Notify the shift coordinator to review the priority queue and staffing.",
    );
  const observation = data.areas.find((a) => a.area === "Observation")!;
  if (observation.occupied / observation.staffedCapacity >= 0.85)
    add(
      "observation",
      "Warning",
      "Observation nearing capacity",
      "Observation",
      "Area utilisation ≥ 85%",
      `${observation.occupied} of ${observation.staffedCapacity} staffed spaces are occupied. ${observation.waiting} patients are waiting for transfer.`,
      "Review pending transfers and available inpatient capacity.",
    );
  if (m.imbalance)
    add(
      "arrivals",
      "Warning",
      "Arrivals outpacing departures",
      "Emergency Department",
      "Arrivals > departures for 3 consecutive hours",
      "Incoming demand has exceeded departures in each of the last three hours.",
      "Review discharge coordination and reassign available support staff.",
    );
  if (!options.historical && freshness(data.updatedAt).status === "Stale")
    add(
      "stale",
      "Warning",
      "Data feed is stale",
      "Synthetic ED Event Feed",
      "Latest data update > 20 minutes old",
      "Displayed metrics reflect an earlier snapshot and may no longer represent current operations.",
      "Investigate the delayed data feed and verify current capacity locally.",
    );
  if (!alerts.length)
    add(
      "stable",
      "Information",
      "Operations within configured limits",
      "Emergency Department",
      "No demonstration thresholds exceeded",
      "Bed capacity, priority waiting times and arrival flow are within the configured limits.",
      "Continue routine monitoring of patient flow and staffed capacity.",
    );
  return alerts.sort(
    (a, b) =>
      ({ Critical: 0, Warning: 1, Information: 2 })[a.severity] -
      { Critical: 0, Warning: 1, Information: 2 }[b.severity],
  );
}
