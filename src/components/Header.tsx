import { Compass, Database, RefreshCw } from "lucide-react";
import type { Scenario } from "../types/dashboard";
import { time } from "../utils/formatters";
export function Header({
  scenario,
  onScenario,
  updatedAt,
  status,
  loading,
  onRefresh,
}: {
  scenario: Scenario;
  onScenario: (s: Scenario) => void;
  updatedAt?: string;
  status: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <>
      <header className="simple-header">
        <div className="simple-brand">
          <Compass size={30} />
          <div>
            <strong>AcuityCompass</strong>
            <span>Emergency department, at a glance</span>
          </div>
        </div>
        <span className="sample-tag">Student prototype</span>
      </header>
      <div className="simple-intro">
        <div>
          <h1>One department. One clear view.</h1>
          <p>
            See who is waiting, where beds are filling up, and what needs
            attention.
          </p>
        </div>
      </div>
      <div className="demo-notice">
        <Database size={21} />
        <div>
          <strong>Sample data only — no hospital dataset connected</strong>
          <p>
            These numbers come from built-in, fictional patient records. Choose
            an example to see how the dashboard responds.
          </p>
        </div>
      </div>
      <div className="demo-controls">
        <label>
          Try an example
          <select
            aria-label="Demo scenario"
            value={scenario}
            onChange={(e) => onScenario(e.target.value as Scenario)}
            disabled={loading}
          >
            <option value="normal">Normal Operations</option>
            <option value="high">High Demand</option>
            <option value="stale">Stale Data</option>
          </select>
        </label>
        <div>
          <span className="sample-freshness">
            {status === "Live"
              ? "Sample ready"
              : status === "Stale"
                ? "Outdated sample"
                : status === "Delayed"
                  ? "Sample update delayed"
                  : status}{" "}
            · {updatedAt ? `Generated ${time(updatedAt)}` : "Preparing sample"}
          </span>
          <button
            className="refresh-button"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spinning" : ""} />
            Reset example
          </button>
        </div>
      </div>
    </>
  );
}
export function Footer() {
  return (
    <footer className="simple-footer">
      <strong>AcuityCompass · Synthetic ED Event Feed</strong>
      <p>
        All figures are fictional demonstration data. No hospital system is
        connected.
      </p>
      <p>
        Prototype using synthetic data for operational decision support. Not
        intended for clinical diagnosis or direct patient care.
      </p>
    </footer>
  );
}
