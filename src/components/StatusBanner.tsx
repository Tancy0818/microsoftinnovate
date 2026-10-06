import { CircleCheck, TriangleAlert } from "lucide-react";
import type { DashboardData } from "../types/dashboard";
import { calculateMetrics } from "../utils/calculateMetrics";
export function StatusBanner({
  data,
  stale,
}: {
  data: DashboardData;
  stale: boolean;
}) {
  const m = calculateMetrics(data);
  const pressure = m.pressure === "High" || m.pressure === "Critical";
  const warning = stale || pressure;
  const Icon = warning ? TriangleAlert : CircleCheck;
  return (
    <div
      className={`status-banner ${warning ? "banner-warning" : "banner-stable"}`}
      role="status"
    >
      <Icon size={22} />
      <div>
        <strong>
          {stale
            ? "This example shows outdated data"
            : pressure
              ? `${m.pressure} pressure in this example`
              : "This example is within operating limits"}
        </strong>
        <p>
          {stale
            ? "The sample is more than 20 minutes old. Its figures may no longer reflect current conditions."
            : pressure
              ? `${m.waiting} patients are waiting and ${m.occupied} of ${m.capacity} staffed beds are occupied.`
              : "Beds are available and no urgent operational thresholds have been crossed."}
        </p>
      </div>
    </div>
  );
}
