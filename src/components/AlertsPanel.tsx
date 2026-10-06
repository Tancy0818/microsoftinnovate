import { Check, Info, TriangleAlert } from "lucide-react";
import type { OperationalAlert, OperationalTask } from "../types/dashboard";
import { time } from "../utils/formatters";
import { Badge } from "./Common";
export function AttentionPanel({
  alerts,
  tasks,
  onAcknowledge,
  onStatus,
}: {
  alerts: OperationalAlert[];
  tasks: OperationalTask[];
  onAcknowledge: (id: string) => void;
  onStatus: (id: string, status: OperationalTask["status"]) => void;
}) {
  return (
    <section aria-label="Issues and next steps">
      <div className="attention-grid">
        {alerts.map((a) => {
          const task = tasks.find((t) => t.relatedAlertId === a.id);
          const tone =
            a.severity === "Critical"
              ? "critical"
              : a.severity === "Warning"
                ? "warning"
                : "info";
          const Icon = a.severity === "Information" ? Info : TriangleAlert;
          return (
            <article className={`attention-card ${tone}`} key={a.id}>
              <div className="attention-heading">
                <Icon size={18} />
                <h3>{a.title}</h3>
                <Badge tone={tone}>{a.severity}</Badge>
              </div>
              <p>{a.explanation}</p>
              <div className="next-step">
                <strong>Next step</strong>
                <p>{a.suggestedAction}</p>
              </div>
              <details>
                <summary>Why was this flagged?</summary>
                <p>
                  {a.trigger} · Raised {time(a.createdAt)}
                </p>
                <p>Affected: {a.affectedEntity}</p>
              </details>
              <div className="attention-controls">
                <button
                  onClick={() => onAcknowledge(a.id)}
                  disabled={a.status !== "Open"}
                >
                  <Check size={14} />
                  {a.status === "Open" ? "Mark as seen" : "Seen"}
                </button>
                {task && (
                  <label>
                    {task.assignedRole}
                    <select
                      aria-label={`Status for ${task.description}`}
                      value={task.status}
                      onChange={(e) =>
                        onStatus(
                          task.id,
                          e.target.value as OperationalTask["status"],
                        )
                      }
                    >
                      <option>Open</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </label>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="threshold-note">
        Alerts use simple demonstration rules, not AI: bed occupancy ≥85% is a
        warning, ≥95% is critical; high-acuity waiting over 15 minutes is
        critical. Hospitals would configure their own limits.
      </p>
    </section>
  );
}
