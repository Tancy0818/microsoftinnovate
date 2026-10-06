import { BedDouble, Clock3, Users, UsersRound } from "lucide-react";
import type { DashboardData } from "../types/dashboard";
import { calculateMetrics } from "../utils/calculateMetrics";
export function MetricCards({
  data,
  stale,
}: {
  data: DashboardData;
  stale: boolean;
}) {
  const m = calculateMetrics(data);
  const cards = [
    {
      label: "Patients in the ED",
      value: m.active,
      unit: "patients",
      note: "All fictional patient records",
      icon: Users,
    },
    {
      label: "Patients waiting",
      value: m.waiting,
      unit: "patients",
      note: "Waiting for the next stage of care",
      icon: UsersRound,
    },
    {
      label: "Average wait",
      value: m.average,
      unit: "minutes",
      note: "For patients currently in a queue",
      icon: Clock3,
    },
    {
      label: "Staffed beds occupied",
      value: `${m.occupied} / ${m.capacity}`,
      unit: "beds",
      note: `${m.occupancy}% of available staffed beds`,
      icon: BedDouble,
    },
  ];
  return (
    <div className="metrics">
      {cards.map((c) => (
        <article className="metric-card" key={c.label}>
          <div className="metric-label">
            {c.label}
            <c.icon size={18} />
          </div>
          <div className="metric-value">
            {c.value}
            <span>{c.unit}</span>
          </div>
          <p className="metric-note">{c.note}</p>
          {stale && (
            <span className="outdated-label">Potentially outdated</span>
          )}
        </article>
      ))}
    </div>
  );
}
