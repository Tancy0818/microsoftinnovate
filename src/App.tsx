import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BedDouble,
  Clock3,
  Compass,
  Database,
  Users,
  UsersRound,
  X,
  Activity,
  ChevronRight,
  ShieldCheck,
  Plus,
  Search,
  ArrowDown,
} from "lucide-react";
import type {
  DashboardData,
  FollowupInput,
  OperationalTask,
  Scenario,
} from "./types/dashboard";
import {
  getDatabaseDashboard,
  saveDatabaseAction,
  saveDatabaseFollowup,
} from "./services/apiDashboardService";
import { dashboardProvider } from "./services/mockDashboardService";
import {
  calculateMetrics,
  freshness,
  isWaiting,
} from "./utils/calculateMetrics";
import { time, triageColors } from "./utils/formatters";
import {
  ArrivalDepartureChart,
  CapacityPanel,
  PatientFlowChart,
  TriageChart,
} from "./components/Charts";
import { PatientQueue } from "./components/PatientQueue";
import { TransferFollowups } from "./components/TransferFollowups";
import {
  InteractivePatients,
  requestInteractive,
} from "./components/InteractivePatients";
import { interactiveDashboard } from "./utils/interactiveDashboard";
import { AttentionPanel } from "./components/AlertsPanel";
import { PowerBIReport } from "./components/PowerBIReport";
import { powerBIReportUrl } from "./utils/powerBIReportUrl";
import "./dashboard.css";
import { Planner } from "./components/Planner";
import "./workspace.css";

type Detail =
  | "patients"
  | "waiting"
  | "wait"
  | "capacity"
  | "flow"
  | "arrivals"
  | "triage"
  | "alerts"
  | "transfers"
  | "entry"
  | "update";
const titles: Record<Detail, string> = {
  patients: "Active patients",
  waiting: "Patients waiting",
  wait: "Waiting time by urgency",
  capacity: "Capacity by area",
  flow: "Patient flow",
  arrivals: "Arrivals & departures",
  triage: "Patient urgency",
  alerts: "Needs attention",
  transfers: "Transfer coordination",
  entry: "Patient registration & movement",
  update: "Find & update a patient",
};
export default function App() {
  const [source, setSource] = useState<
    Scenario | "empty" | "database" | "interactive"
  >("interactive");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null),
    [alertId, setAlertId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0),
    [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false),
    [actionError, setActionError] = useState("");
  const [preferReport, setPreferReport] = useState(true);
  const configuredReport = import.meta.env.VITE_POWER_BI_EMBED_URL as
    string | undefined;
  const reportUrl = powerBIReportUrl(configuredReport);
  const showReport = source === "database" && !!reportUrl && preferReport;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    setActionError("");
    setDetail((d) =>
      (d === "entry" || d === "update") && source === "interactive" ? d : null,
    );
    if (source === "empty") {
      setLoading(false);
      return;
    }
    setLoading(true);
    (source === "database"
      ? getDatabaseDashboard().then((result) => result.data)
      : source === "interactive"
        ? requestInteractive().then(interactiveDashboard)
        : dashboardProvider.getDashboard(source)
    )
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Unable to load sample data.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, revision]);
  useEffect(() => {
    if (!detail) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [detail]);
  const open = (d: Detail, id: string | null = null) => {
    setAlertId(id);
    setDetail(d);
  };
  const metrics = data ? calculateMetrics(data) : null;
  const saveFollowup = async (input: FollowupInput, expectedId: number) => {
    if (!data) throw new Error("Load a snapshot first.");
    if (source === "database") {
      const result = await saveDatabaseFollowup({
        ...input,
        expectedId,
        snapshotTime: data.updatedAt,
      });
      setData(result.data);
    } else {
      setData((d) =>
        d
          ? {
              ...d,
              followups: [
                {
                  ...input,
                  id: Math.max(0, ...(d.followups ?? []).map((f) => f.id)) + 1,
                  recordedAt: new Date().toISOString(),
                },
                ...(d.followups ?? []),
              ],
            }
          : d,
      );
    }
  };
  const stale =
    data && source !== "database"
      ? freshness(data.updatedAt, now).status !== "Live"
      : false;
  const persistAction = async (
    alertId: string,
    kind: "acknowledge" | "task",
    status?: string,
  ) => {
    if (!data || saving) return;
    setSaving(true);
    setActionError("");
    try {
      const result = await saveDatabaseAction({
        snapshotTime: data.updatedAt,
        alertId,
        kind,
        status,
      });
      setData(result.data);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to save action.");
    } finally {
      setSaving(false);
    }
  };
  const acknowledge = (id: string) => {
    if (source === "database") {
      void persistAction(id, "acknowledge");
      return;
    }
    setData((d) =>
      d
        ? {
            ...d,
            alerts: d.alerts.map((a) =>
              a.id === id ? { ...a, status: "Acknowledged" } : a,
            ),
          }
        : d,
    );
  };
  const updateTask = (id: string, status: OperationalTask["status"]) => {
    if (source === "database") {
      const alert = data?.tasks.find((t) => t.id === id)?.relatedAlertId;
      if (alert) void persistAction(alert, "task", status);
      return;
    }
    setData((d) =>
      d
        ? {
            ...d,
            tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
          }
        : d,
    );
  };
  const cards = [
    {
      title: "Active patients",
      value: metrics?.active,
      unit: "in the department",
      icon: Users,
      detail: "patients" as Detail,
      note: "Explore patient queue",
    },
    {
      title: "Patients waiting",
      value: metrics?.waiting,
      unit: "awaiting next stage",
      icon: UsersRound,
      detail: "waiting" as Detail,
      note: "View waiting patients",
    },
    {
      title: "Average elapsed wait",
      value: metrics
        ? metrics.average >= 1440
          ? `${(metrics.average / 1440).toFixed(1)} d`
          : metrics.average >= 60
            ? `${(metrics.average / 60).toFixed(1)} h`
            : `${metrics.average} min`
        : undefined,
      unit: "since arrival · waiting patients",
      icon: Clock3,
      detail: "wait" as Detail,
      note: "Compare by urgency",
    },
    {
      title: "Bed occupancy",
      value: metrics ? `${metrics.occupancy}%` : undefined,
      unit: metrics
        ? `${metrics.occupied} of ${metrics.capacity} configured beds`
        : "configured beds",
      icon: BedDouble,
      detail: "capacity" as Detail,
      note: "Explore capacity",
    },
  ];
  const empty = (
    <div className="dash-empty">
      <Database size={25} />
      <strong>
        {loading
          ? "Loading records…"
          : error
            ? "Data unavailable"
            : "No records loaded"}
      </strong>
      <span>
        {error
          ? "Retry using the button above"
          : loading
            ? "Fetching the selected data source"
            : source === "database"
              ? "Database connected · No dataset imported"
              : "Choose a demo to preview this view"}
      </span>
    </div>
  );
  return (
    <div className="dashboard-shell">
      <a href="#main-content" className="skip-link">
        Skip to dashboard
      </a>
      <header className="dash-header">
        <div className="dash-brand">
          <span>
            <Compass size={25} />
          </span>
          <strong>AcuityCompass</strong>
          <i /> <span className="dash-product">ED Operations</span>
        </div>
        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={() => {
              setSource("interactive");
              open("update");
            }}
          >
            <Search size={17} /> Update patient
          </button>
          <button
            className="primary-button"
            onClick={() => {
              setSource("interactive");
              open("entry");
            }}
          >
            <Plus size={18} /> Add patient
          </button>
        </div>
      </header>
      <main id="main-content" className="dash-main" aria-busy={loading}>
        <div className="dash-title">
          <div>
            <span className="dash-eyebrow">EMERGENCY DEPARTMENT</span>
            <h1>A clearer view. A better next step.</h1>
            <p className="dash-subtitle">
              Follow patient flow, update records and plan the resources your
              team needs.
            </p>
          </div>
          <label className="dash-source">
            Data source
            <select
              aria-label="Data source"
              disabled={saving}
              value={source}
              onChange={(e) =>
                setSource(e.target.value as Scenario | "empty" | "database")
              }
            >
              <option value="database">
                Historical snapshot · September dataset
              </option>
              <option value="interactive">
                Combined patient records · PostgreSQL
              </option>
              <option value="empty">Empty preview</option>
              <option value="normal">Demo · Normal operations</option>
              <option value="high">Demo · High demand</option>
              <option value="stale">Demo · Stale data</option>
            </select>
          </label>
        </div>
        <div className={`dash-status ${stale ? "is-stale" : ""}`}>
          <span>
            <Database size={14} />
            {source === "database"
              ? error
                ? "Database unavailable"
                : loading
                  ? "Connecting to PostgreSQL"
                  : "PostgreSQL · Synthetic data"
              : source === "interactive"
                ? "PostgreSQL · Combined synthetic records"
                : source === "empty"
                  ? "Empty preview · No connection"
                  : "Synthetic demo data"}
            <i />
            {data
              ? source === "database"
                ? `Historical snapshot · ${new Date(data.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} IST`
                : source === "interactive"
                  ? `Last refreshed ${time(data.updatedAt)} · combined patient records`
                  : `${stale ? "Outdated sample · " : ""}Generated ${time(data.updatedAt)}`
              : loading
                ? "Loading records"
                : "Awaiting data"}
          </span>
          {data && (
            <span className="dash-pressure">
              <Activity size={14} />
              {metrics?.pressure} pressure · demo rule
            </span>
          )}
          {source !== "empty" && (
            <button
              onClick={() => setRevision((r) => r + 1)}
              disabled={loading || saving}
            >
              {source === "database" || source === "interactive"
                ? "Refresh data"
                : "Reset demo"}
            </button>
          )}
        </div>
        {error && (
          <div className="dash-error" role="alert">
            {error}
            <button onClick={() => setRevision((r) => r + 1)}>Retry</button>
          </div>
        )}
        {source === "interactive" && (
          <div className="workflow-bar">
            <div>
              <span className="live-dot" />
              <strong>Patient workspace</strong>
              <span>One connected record, from arrival to departure.</span>
            </div>
            <div>
              <button onClick={() => open("update")}>
                <Search size={15} /> Find & update
              </button>
              <a href="#planning">
                Forecast & plan <ArrowDown size={15} />
              </a>
            </div>
          </div>
        )}
        <div className="analytics-context">
          <span className="analytics-label">
            {showReport ? "POWER BI ANALYTICS" : "OPERATIONS OVERVIEW"}
          </span>
          {!showReport && (
            <span>
              {source === "interactive"
                ? "September snapshot continued + website entries · Original dates retained; elapsed times include days since the snapshot"
                : source !== "database"
                  ? "Demo charts · Power BI uses the published dataset"
                  : reportUrl
                    ? "Local preview selected"
                    : configuredReport
                      ? "Report URL needs configuration · Showing local charts"
                      : "Database charts available · Power BI can be presented separately"}
            </span>
          )}
          {!showReport && reportUrl && source === "database" && (
            <button onClick={() => setPreferReport(true)}>
              Show Power BI report
            </button>
          )}
        </div>
        {showReport && reportUrl ? (
          <PowerBIReport
            url={reportUrl}
            onPreview={() => setPreferReport(false)}
          />
        ) : (
          <>
            <div className="dash-kpis">
              {cards.map((c) => (
                <button
                  key={c.title}
                  className="dash-kpi"
                  onClick={() => open(c.detail)}
                >
                  <span className="dash-kpi-label">
                    {c.title}
                    <c.icon size={19} />
                  </span>
                  <strong>{c.value ?? "—"}</strong>
                  <span className="dash-kpi-unit">{c.unit}</span>
                  <span className="dash-kpi-link">
                    {c.note}
                    <ArrowUpRight size={15} />
                  </span>
                </button>
              ))}
            </div>
            <div className="dash-charts">
              <Tile
                title="Arrivals vs. departures"
                caption="Last 12 hours"
                onOpen={() => open("arrivals")}
                className="dash-arrivals"
              >
                {data ? <ArrivalDepartureChart data={data} /> : empty}
              </Tile>
              <Tile
                title="Patient flow"
                caption="Patients by current stage"
                onOpen={() => open("flow")}
              >
                {data ? <PatientFlowChart patients={data.patients} /> : empty}
              </Tile>
              <Tile
                title="Area capacity"
                caption="Occupied / configured spaces"
                onOpen={() => open("capacity")}
              >
                {data ? (
                  <div className="dash-capacity">
                    {data.areas.map((a) => {
                      const percent = Math.round(
                        (a.occupied / a.staffedCapacity) * 100,
                      );
                      return (
                        <button key={a.area} onClick={() => open("capacity")}>
                          <span>
                            {a.area}
                            <b>
                              {a.occupied}
                              <small> / {a.staffedCapacity}</small>
                            </b>
                          </span>
                          <span className="dash-track">
                            <i
                              style={{
                                width: `${Math.min(100, percent)}%`,
                                background:
                                  percent >= 100
                                    ? "#d46064"
                                    : percent >= 85
                                      ? "#daaa51"
                                      : "#578be1",
                              }}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  empty
                )}
              </Tile>
            </div>
          </>
        )}
        {showReport && (
          <div className="operation-shortcuts" aria-label="Operational details">
            {cards.map((c) => (
              <button key={c.detail} onClick={() => open(c.detail)}>
                <c.icon size={17} />
                {c.note}
                <ArrowUpRight size={14} />
              </button>
            ))}
            <button onClick={() => open("flow")}>
              Patient flow
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        {source === "interactive" && (
          <Planner revision={`${revision}-${data?.updatedAt ?? ""}`} />
        )}
        <div className="dash-bottom">
          {showReport ? (
            <Tile
              title="Patient queue"
              caption="Latest database snapshot"
              onOpen={() => open("patients")}
            >
              <div className="operations-intro">
                <UsersRound size={28} />
                <strong>Find a patient. Follow their journey.</strong>
                <p>
                  Search records, filter the queue and open a recorded timeline.
                </p>
                <button
                  className="primary-button"
                  onClick={() => open("patients")}
                >
                  Open patient queue
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </Tile>
          ) : (
            <Tile
              title="Patient urgency"
              caption="Active patients by triage level"
              onOpen={() => open("triage")}
            >
              {data ? <TriageChart patients={data.patients} /> : empty}
            </Tile>
          )}
          <Tile
            title="Needs attention"
            caption={
              data
                ? `${data.alerts.filter((a) => a.status === "Open" && a.severity !== "Information").length} open alerts`
                : "Operational alerts"
            }
            onOpen={() => open("alerts")}
          >
            {data ? (
              <div className="dash-alerts">
                {data.alerts.length ? (
                  data.alerts.slice(0, 3).map((a) => (
                    <button key={a.id} onClick={() => open("alerts", a.id)}>
                      <span
                        className={`dash-alert-dot ${a.severity.toLowerCase()}`}
                      />
                      <span>
                        <strong>{a.title}</strong>
                        <small>
                          {a.affectedEntity} · {a.status}
                        </small>
                      </span>
                      <span className="dash-severity">{a.severity}</span>
                      <ChevronRight size={17} />
                    </button>
                  ))
                ) : (
                  <div className="dash-empty">
                    <ShieldCheck size={28} />
                    <strong>No active alerts</strong>
                    <span>Nothing currently flagged by demo rules</span>
                  </div>
                )}
              </div>
            ) : (
              empty
            )}
          </Tile>
        </div>
        {!showReport && (
          <div className="operations-access">
            <span>
              <strong>Patient records & actions</strong>
              <small>Search and manage the latest operational snapshot</small>
            </span>
            <button
              onClick={() => {
                setSource("interactive");
                open("entry");
              }}
            >
              Add / update fictional patients <ArrowUpRight size={15} />
            </button>
            <button onClick={() => open("patients")}>
              Open patient queue <ArrowUpRight size={15} />
            </button>
            <button onClick={() => open("alerts")}>
              Manage actions <ArrowUpRight size={15} />
            </button>
          </div>
        )}
        <div className="operations-access">
          <span>
            <strong>Transfer coordination</strong>
            <small>
              Recorded blockers, team ownership and handover history
            </small>
          </span>
          <button onClick={() => open("transfers")}>
            Open transfer follow-up <ArrowUpRight size={15} />
          </button>
          <a
            href="https://app.powerbi.com/groups/me/reports/b023ed8a-2ef6-4332-b15b-ddecb8368652/overview"
            target="_blank"
            rel="noreferrer"
          >
            Open Power BI report ↗
          </a>
        </div>
        <p className="presentation-note">
          Power BI opens separately and requires your account. For an offline
          presentation, open AcuityCompass.pbip in Power BI Desktop. The
          operations page does not require Power BI access.
        </p>
        <footer className="dash-footer">
          <span>AcuityCompass · Operations dashboard</span>
          <span>
            {source === "empty"
              ? "Connect data to begin"
              : "Fictional records · Not for clinical use"}
          </span>
        </footer>
      </main>
      {detail && (
        <dialog
          className="dash-drawer"
          ref={dialog}
          aria-labelledby="drawer-title"
          onCancel={() => setDetail(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div className="dash-drawer-inner">
            <header>
              <div>
                <span className="dash-eyebrow">
                  {data
                    ? source === "database"
                      ? "SYNTHETIC DATA · POSTGRESQL"
                      : source === "interactive"
                        ? "SAVED FICTIONAL PATIENTS · POSTGRESQL"
                        : "SYNTHETIC DEMO · DETAILS"
                    : "DASHBOARD DETAILS"}
                </span>
                <h2 id="drawer-title">{titles[detail]}</h2>
              </div>
              <button
                autoFocus
                aria-label="Close details"
                onClick={() => setDetail(null)}
              >
                <X size={22} />
              </button>
            </header>
            <div className="dash-drawer-content">
              {actionError && (
                <p role="alert" className="dash-error">
                  {actionError}
                </p>
              )}
              {saving && <p role="status">Saving action…</p>}
              {detail === "entry" || detail === "update" ? (
                <InteractivePatients
                  key={detail}
                  initialAdd={detail === "entry"}
                  onData={(d) => setData(interactiveDashboard(d))}
                />
              ) : !data ? (
                empty
              ) : (
                <>
                  {detail === "transfers" && source === "interactive" && (
                    <InteractivePatients
                      onData={(d) => setData(interactiveDashboard(d))}
                    />
                  )}
                  {detail === "transfers" && source !== "interactive" && (
                    <TransferFollowups
                      data={data}
                      database={source === "database"}
                      onSave={saveFollowup}
                    />
                  )}
                  {(detail === "patients" || detail === "waiting") &&
                    (source === "interactive" ? (
                      <InteractivePatients
                        onData={(d) => setData(interactiveDashboard(d))}
                      />
                    ) : (
                      <PatientQueue
                        key={detail}
                        patients={
                          detail === "waiting"
                            ? data.patients.filter(isWaiting)
                            : data.patients
                        }
                        expanded
                      />
                    ))}
                  {detail === "capacity" && (
                    <CapacityPanel data={data} expanded />
                  )}
                  {detail === "flow" && (
                    <>
                      <PatientFlowChart patients={data.patients} />
                      <PatientQueue patients={data.patients} />
                    </>
                  )}
                  {detail === "arrivals" && (
                    <>
                      <ArrivalDepartureChart data={data} />
                      <table className="dash-data-table">
                        <thead>
                          <tr>
                            <th>Hour</th>
                            <th>Arrivals</th>
                            <th>Departures</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.history.map((h) => (
                            <tr key={h.hour}>
                              <td>{h.hour}:00</td>
                              <td>{h.arrivals}</td>
                              <td>{h.departures}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                  {detail === "triage" && (
                    <>
                      <TriageChart patients={data.patients} />
                      <PatientQueue patients={data.patients} />
                    </>
                  )}
                  {detail === "wait" && (
                    <>
                      <p>
                        Average elapsed wait for patients currently awaiting the
                        next stage of care.
                      </p>
                      <table className="dash-data-table">
                        <thead>
                          <tr>
                            <th>Urgency</th>
                            <th>Waiting patients</th>
                            <th>Average wait</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(triageColors).map(
                            ([level, color]) => {
                              const group = data.patients.filter(
                                (p) => isWaiting(p) && p.triageLevel === level,
                              );
                              return (
                                <tr key={level}>
                                  <td>
                                    <i
                                      className="legend-dot"
                                      style={{ background: color }}
                                    />{" "}
                                    {level}
                                  </td>
                                  <td>{group.length}</td>
                                  <td>
                                    {group.length
                                      ? `${Math.round(group.reduce((sum, p) => sum + p.waitingMinutes, 0) / group.length)} min`
                                      : "—"}
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                      <PatientQueue
                        patients={data.patients.filter(isWaiting)}
                      />
                    </>
                  )}
                  {detail === "alerts" && (
                    <fieldset
                      disabled={saving || source === "interactive"}
                      className="action-fieldset"
                    >
                      {source === "interactive" && (
                        <p>
                          Warnings are calculated from combined patient records.
                          Update the patient record to reflect a change;
                          historical alert tasks are separate.
                        </p>
                      )}
                      <AttentionPanel
                        alerts={
                          alertId
                            ? data.alerts.filter((a) => a.id === alertId)
                            : data.alerts
                        }
                        tasks={
                          alertId
                            ? data.tasks.filter(
                                (t) => t.relatedAlertId === alertId,
                              )
                            : data.tasks
                        }
                        onAcknowledge={acknowledge}
                        onStatus={updateTask}
                      />
                    </fieldset>
                  )}
                </>
              )}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
function Tile({
  title,
  caption,
  onOpen,
  children,
  className = "",
}: {
  title: string;
  caption: string;
  onOpen: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dash-tile ${className}`}>
      <button
        className="dash-tile-heading"
        onClick={onOpen}
        aria-label={`View ${title} details`}
      >
        <span>
          <strong>{title}</strong>
          <small>{caption}</small>
        </span>
        <ArrowUpRight size={18} />
      </button>
      <div className="dash-tile-body">{children}</div>
    </section>
  );
}
