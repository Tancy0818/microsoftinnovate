import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  SlidersHorizontal,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  CircleHelp,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
} from "recharts";
import type { Forecast, PlannerSettings, PlanRun } from "../types/planner";
import "../planner.css";
interface State {
  settings: PlannerSettings;
  version: number;
  forecast: Forecast | null;
  runs: PlanRun[];
  asOf: string;
  areas: { id: string; name: string; capacity: number; occupied: number }[];
}
const stamp = (s: string) =>
  new Date(s).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
async function request(body?: object): Promise<State> {
  const response = await fetch("/api/planner", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json().catch(() => {
    throw new Error(
      "The API did not return data. Check that the local service is running, then retry.",
    );
  });
  if (!response.ok)
    throw new Error(result.error || "Unable to load planning data.");
  return result;
}
export function Planner({ revision }: { revision: string }) {
  const [state, setState] = useState<State | null>(null),
    [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [note, setNote] = useState("");
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const [view, setView] = useState<"forecast" | "plan" | "history">("forecast");
  const load = async (body?: object) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request(body);
      setState(result);
      setSettings(result.settings);
      setDirty(false);
      setConfirmed(false);
      if (body) setNotice("Saved to PostgreSQL.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    request()
      .then((result) => {
        if (!cancelled) {
          setState((previous) =>
            dirtyRef.current && previous
              ? {
                  ...result,
                  settings: previous.settings,
                  version: previous.version,
                }
              : result,
          );
          setSettings((previous) =>
            dirtyRef.current ? previous : result.settings,
          );
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  const change = (next: PlannerSettings) => {
    setSettings(next);
    setDirty(true);
  };
  const run = state?.runs[0];
  const forecast = state?.forecast;
  return (
    <section
      className="intelligence"
      id="planning"
      aria-label="Forecasting and operational planning"
      aria-busy={busy}
    >
      <div className="intelligence-heading">
        <div className="intelligence-title">
          <span className="intelligence-icon">
            <BrainCircuit size={25} />
          </span>
          <div>
            <span className="dash-eyebrow">LOOK AHEAD · PLAN · LEARN</span>
            <h2>Plan the next hour</h2>
            <p>
              Explore demand and compare the actions available to your team.
            </p>
          </div>
        </div>
        <div className="planner-actions">
          <button
            disabled={busy}
            onClick={() => void load()}
            aria-label="Refresh planning data"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="secondary-button"
            onClick={() => setEditing(!editing)}
            aria-expanded={editing}
          >
            <SlidersHorizontal size={16} /> Resources & assumptions
          </button>
        </div>
      </div>
      <div className="planner-tabs" role="tablist" aria-label="Planning views">
        {(
          [
            ["forecast", "Demand forecast"],
            ["plan", "Compare actions"],
            ["history", "Action history"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            id={`tab-${key}`}
            aria-controls={`panel-${key}`}
            aria-selected={view === key}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="dash-error" role="alert">
          {error}{" "}
          <button disabled={busy} onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {notice && (
        <p className="planner-success" role="status">
          <CheckCircle2 size={16} />
          {notice}
        </p>
      )}
      {!state && !error && (
        <p className="planner-notice" role="status">
          Loading model and resource records…
        </p>
      )}
      {editing && settings && state && (
        <form
          className="resource-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await load({ kind: "settings", settings, version: state.version })
            )
              setEditing(false);
          }}
        >
          <div className="section-heading">
            <div>
              <h3>Available resources</h3>
              <p>
                Enter fictional demo assumptions. Staffing starts at zero until
                configured; these are not measured hospital resources.
              </p>
            </div>
            <span className="planner-tag">
              {state.version ? `Version ${state.version}` : "Setup required"}
            </span>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() =>
              change({
                ...settings,
                resources: settings.resources.map((r) => ({
                  ...r,
                  readyBeds: Math.min(
                    state.areas.find((a) => a.id === r.areaId)!.capacity,
                    Math.max(
                      2,
                      state.areas.find((a) => a.id === r.areaId)!.occupied + 2,
                    ),
                  ),
                  staff: Math.max(
                    1,
                    Math.ceil(
                      state.areas.find((a) => a.id === r.areaId)!.occupied / 2,
                    ),
                  ),
                  minimumStaff: 1,
                  reserveStaff: r.areaId === settings.targetArea ? 1 : 0,
                  bedsPerStaff: 2,
                  serviceMinutes: 60,
                })),
              })
            }
          >
            Fill fictional demo assumptions
          </button>
          <fieldset disabled={busy}>
            <div className="table-scroll">
              <table className="resource-table">
                <thead>
                  <tr>
                    <th>Area / current beds</th>
                    <th>Ready spaces</th>
                    <th>Qualified staff</th>
                    <th>Spaces / staff</th>
                    <th>Service min</th>
                    <th>Reserve staff</th>
                    <th>Minimum staff</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.resources.map((r, i) => (
                    <tr key={r.areaId}>
                      <th>
                        {state.areas.find((a) => a.id === r.areaId)?.name}
                        <small>
                          {state.areas.find((a) => a.id === r.areaId)?.occupied}{" "}
                          occupied ·{" "}
                          {state.areas.find((a) => a.id === r.areaId)?.capacity}{" "}
                          limit
                        </small>
                      </th>
                      {(
                        [
                          "readyBeds",
                          "staff",
                          "bedsPerStaff",
                          "serviceMinutes",
                          "reserveStaff",
                          "minimumStaff",
                        ] as const
                      ).map((key) => (
                        <td key={key}>
                          <input
                            aria-label={`${key} for ${state.areas.find((a) => a.id === r.areaId)?.name}`}
                            type="number"
                            required
                            step="1"
                            min={
                              key === "bedsPerStaff"
                                ? 1
                                : key === "serviceMinutes"
                                  ? 5
                                  : 0
                            }
                            max={
                              key === "readyBeds"
                                ? state.areas.find((a) => a.id === r.areaId)
                                    ?.capacity
                                : key === "serviceMinutes"
                                  ? 480
                                  : key === "bedsPerStaff"
                                    ? 10
                                    : key === "minimumStaff"
                                      ? r.staff
                                      : 100
                            }
                            value={r[key]}
                            onChange={(e) =>
                              change({
                                ...settings,
                                resources: settings.resources.map((v, j) =>
                                  i === j
                                    ? { ...v, [key]: Number(e.target.value) }
                                    : v,
                                ),
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="resource-fields">
              <label>
                Area receiving new demand
                <select
                  value={settings.targetArea}
                  onChange={(e) =>
                    change({
                      ...settings,
                      targetArea: e.target.value,
                      donorArea:
                        settings.donorArea === e.target.value
                          ? settings.resources.find(
                              (r) => r.areaId !== e.target.value,
                            )!.areaId
                          : settings.donorArea,
                    })
                  }
                >
                  {settings.resources.map((r) => (
                    <option key={r.areaId} value={r.areaId}>
                      {state.areas.find((a) => a.id === r.areaId)?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Possible staff donor
                <select
                  value={settings.donorArea}
                  onChange={(e) =>
                    change({ ...settings, donorArea: e.target.value })
                  }
                >
                  {settings.resources
                    .filter((r) => r.areaId !== settings.targetArea)
                    .map((r) => (
                      <option key={r.areaId} value={r.areaId}>
                        {state.areas.find((a) => a.id === r.areaId)?.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Approved transfers from target area
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.transferCount}
                  required
                  onChange={(e) =>
                    change({
                      ...settings,
                      transferCount: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Receiving ward ready?
                <select
                  value={settings.wardReady}
                  onChange={(e) =>
                    change({
                      ...settings,
                      wardReady: e.target.value as PlannerSettings["wardReady"],
                    })
                  }
                >
                  <option value="unknown">Not confirmed</option>
                  <option value="yes">Confirmed ready</option>
                  <option value="no">Not ready</option>
                </select>
              </label>
            </div>
            <p className="field-help">
              Reserve support assumes qualified staff and up to two additional
              ready spaces. Redeployment assumes the selected staff member can
              work in the receiving area. Confirm these assumptions for the
              scenario.
            </p>
            <div className="planner-actions">
              <button className="primary-button" type="submit">
                Verify & save resources
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettings(state.settings);
                  setDirty(false);
                  setEditing(false);
                }}
              >
                Cancel changes
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {view === "forecast" && (
        <div role="tabpanel" id="panel-forecast" aria-labelledby="tab-forecast">
          {forecast ? (
            <>
              <div className="forecast-layout">
                <div>
                  <div className="section-heading">
                    <div>
                      <h3>Expected arrivals · next 24 hours</h3>
                      <p>
                        IST · band shows an empirical hourly prediction range
                      </p>
                    </div>
                    <span className="planner-tag">Synthetic-data model</span>
                  </div>
                  <div className="forecast-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={forecast.points.map((p) => ({
                          ...p,
                          range: [p.lower, p.upper],
                          label: new Date(p.time).toLocaleTimeString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }),
                        }))}
                        margin={{ top: 15, right: 20, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 4" vertical={false} />
                        <XAxis dataKey="label" minTickGap={35} />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(_, payload) =>
                            payload[0]?.payload?.time
                              ? stamp(payload[0].payload.time) + " IST"
                              : ""
                          }
                        />
                        <Area
                          dataKey="range"
                          name="Empirical range"
                          fill="#d6e9e7"
                          stroke="none"
                        />
                        <Line
                          type="monotone"
                          dataKey="expected"
                          name="Expected arrivals"
                          stroke="#137d79"
                          dot={false}
                          strokeWidth={3}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <aside className="model-summary">
                  <span className="dash-eyebrow">MODEL CHECK</span>
                  <h3>{forecast.model}</h3>
                  <strong>
                    {forecast.testMae}
                    <small> patients / hour</small>
                  </strong>
                  <p>
                    Mean absolute error on {forecast.testHours} held-out hours
                  </p>
                  <dl>
                    <dt>Seasonal baseline error</dt>
                    <dd>{forecast.testBaselineMae}</dd>
                    <dt>Test range coverage</dt>
                    <dd>{forecast.coverage}%</dd>
                    <dt>Training observations</dt>
                    <dd>{forecast.hours} hours</dd>
                  </dl>
                  <button
                    className="text-action"
                    onClick={() => setView("plan")}
                  >
                    Use in a comparison <ArrowRight size={15} />
                  </button>
                </aside>
              </div>
              <p className="planner-notice">
                <CircleHelp size={18} />
                <span>
                  {forecast.stale
                    ? "Historical demand projected onto today’s clock; no live demand feed. "
                    : "Synthetic demand model. "}
                  Training data: {stamp(forecast.trainedFrom)}–
                  {stamp(forecast.trainedThrough)} IST. New patient entries
                  change the operational state; they do not constitute complete
                  hourly training data.
                </span>
              </p>
              <details className="method-details">
                <summary>How the model is trained and tested</summary>
                <p>
                  A ridge regression learns hour-of-day and weekday patterns.
                  The first 60% of chronological hours trains the candidates;
                  the next 20% selects regression or an hourly seasonal mean and
                  calibrates the nominal 80% range. The final 20% is held out
                  for the displayed test error and coverage. The selected model
                  is then refitted on all imported hours for forecasts. Range
                  coverage can change after refitting and with new demand
                  patterns. No clinical outcomes are predicted.
                </p>
              </details>
            </>
          ) : (
            state && (
              <p className="planner-notice">
                Forecast unavailable. Import at least 14 consecutive days of
                complete hourly arrivals. Missing hours are not treated as zero.
              </p>
            )
          )}
        </div>
      )}
      {view === "plan" && (
        <div role="tabpanel" id="panel-plan" aria-labelledby="tab-plan">
          <div className="section-heading">
            <div>
              <h3>Compare a 60-minute scenario</h3>
              <p>
                Use the combined patient list and your saved resource
                assumptions.
              </p>
            </div>
            <button
              className="primary-button"
              disabled={busy || dirty || !state?.version || !forecast}
              onClick={() =>
                void load({ kind: "compare", version: state?.version })
              }
            >
              {busy ? "Calculating…" : "Compare actions"}{" "}
              <ArrowRight size={16} />
            </button>
          </div>
          {(!state?.version || dirty) && (
            <p className="planner-notice">
              {dirty
                ? "Save your resource changes before comparing."
                : "Open Resources & assumptions to configure staffing and service times first."}
            </p>
          )}
          {run && (
            <>
              <div className="capacity-strip">
                {run.result.capacity.map((a) => (
                  <div key={a.areaId}>
                    <span>{a.name}</span>
                    <strong>
                      {a.usable}
                      <small> / {a.physical} usable</small>
                    </strong>
                    <p>
                      {a.occupied} occupied · {a.constraint}
                    </p>
                  </div>
                ))}
              </div>
              <div className="plan-context">
                <strong>
                  {run.result.startingQueue} waiting for treatment at comparison
                </strong>
                <span>
                  + {run.result.expectedArrivals} expected arrivals in the next
                  complete hour used as the scenario rate
                </span>
                <span>Compared {stamp(run.created_at)} IST</span>
              </div>
              <div className="option-grid">
                {run.result.options.map((o) => (
                  <article
                    key={o.id}
                    className={`option-card ${!o.feasible ? "unavailable" : ""} ${run.result.recommendation === o.id ? "recommended" : ""}`}
                  >
                    <span className="planner-tag">
                      {!o.feasible
                        ? "Unavailable"
                        : run.result.recommendation === o.id
                          ? "Leading option"
                          : o.id === "baseline"
                            ? "Baseline"
                            : "Scenario option"}
                    </span>
                    <h3>{o.title}</h3>
                    <strong>
                      {o.feasible ? o.queue : "—"}
                      <small> waiting for treatment after 60 min</small>
                    </strong>
                    <p>
                      {o.feasible
                        ? `Simulation range ${o.lower}–${o.upper} patients. Donor queue increase: ${o.donorPenalty}.`
                        : "Does not meet the configured resource or readiness conditions."}
                    </p>
                    <p>{o.reason}</p>
                    {o.feasible && run.status === "compared" && (
                      <button
                        disabled={busy || dirty || !confirmed}
                        onClick={() =>
                          void load({
                            kind: "status",
                            id: run.id,
                            status: "started",
                            selected: o.id,
                            confirmed,
                            note: "",
                          })
                        }
                      >
                        Record this choice
                      </button>
                    )}
                  </article>
                ))}
              </div>
              {!run.result.recommendation && (
                <p className="planner-notice">
                  <CircleHelp size={18} />
                  <span>
                    No reliable automatic recommendation. Compare the trade-offs
                    and resolve the checks below; a coordinator may still record
                    a scenario choice.
                  </span>
                </p>
              )}
              {!!run.result.verification.length && (
                <div className="verification">
                  <h3>What needs checking?</h3>
                  <ul>
                    {run.result.verification.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
              {run.status === "compared" && (
                <label className="confirm-choice">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I have reviewed the assumptions and checks. Recording a choice
                  starts tracking only; I must separately record actual patient
                  movements.
                </label>
              )}
              {run.status !== "compared" && (
                <p className="planner-success">
                  This comparison is {run.status}. Open Action history to record
                  its outcome.
                </p>
              )}
              <details className="method-details">
                <summary>Simulation assumptions and limitations</summary>
                <ul>
                  {run.result.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
      )}
      {view === "history" && (
        <div role="tabpanel" id="panel-history" aria-labelledby="tab-history">
          <div className="section-heading">
            <div>
              <h3>Decisions & observed outcomes</h3>
              <p>
                Saved comparisons and coordinator choices. Changes after an
                action do not establish causation.
              </p>
            </div>
          </div>
          {!state?.runs.length && (
            <p className="planner-notice">
              No comparisons yet. Configure resources, then compare actions.
            </p>
          )}
          <label className="outcome-note">
            Outcome or cancellation note
            <input
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened? Include delays or unavailable resources."
            />
          </label>
          <div className="history-list">
            {state?.runs.map((r) => (
              <article key={r.id}>
                <div>
                  <span className="planner-tag">{r.status}</span>
                  <h3>
                    {r.result.options.find((o) => o.id === r.selected)?.title ??
                      "Action comparison"}
                  </h3>
                  <p>
                    {stamp(r.created_at)} IST · {r.result.startingQueue}{" "}
                    initially waiting
                  </p>
                  {r.started_at && <p>Started {stamp(r.started_at)} IST</p>}
                  {r.outcome && (
                    <p>
                      Observed {r.outcome.queue} waiting, {r.outcome.active}{" "}
                      active after {r.outcome.elapsedMinutes} min.{" "}
                      {r.outcome.note}
                    </p>
                  )}
                </div>
                <div className="planner-actions">
                  {r.status === "started" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void load({
                          kind: "status",
                          id: r.id,
                          status: "completed",
                          note,
                        })
                      }
                    >
                      Capture outcome
                    </button>
                  )}
                  {["compared", "started"].includes(r.status) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void load({
                          kind: "status",
                          id: r.id,
                          status: "cancelled",
                          note,
                        })
                      }
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="field-help">
            Power BI can import reporting.planner_outcomes and refresh to show
            these records. Capturing an early outcome records the actual elapsed
            time, not a completed 60-minute experiment.
          </p>
        </div>
      )}
    </section>
  );
}
