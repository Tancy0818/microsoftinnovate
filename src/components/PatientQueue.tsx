import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Search,
  UserRound,
  X,
} from "lucide-react";
import type { Patient } from "../types/dashboard";
import { stages } from "../utils/calculateMetrics";
import { time, triageLabels } from "../utils/formatters";
import { Badge, Panel } from "./Common";
export function PatientQueue({
  patients,
  expanded = false,
}: {
  patients: Patient[];
  expanded?: boolean;
}) {
  const [search, setSearch] = useState(""),
    [triage, setTriage] = useState(""),
    [stage, setStage] = useState(""),
    [area, setArea] = useState(""),
    [descending, setDescending] = useState(true),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Patient | null>(null);
  const filtered = useMemo(
    () =>
      patients
        .filter(
          (p) =>
            p.id.toLowerCase().includes(search.toLowerCase()) &&
            (!triage || p.triageLevel === triage) &&
            (!stage || p.stage === stage) &&
            (!area || p.area === area),
        )
        .sort((a, b) =>
          descending
            ? b.waitingMinutes - a.waitingMinutes
            : a.waitingMinutes - b.waitingMinutes,
        ),
    [patients, search, triage, stage, area, descending],
  );
  const pageSize = expanded ? 12 : 6,
    maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
    currentPage = Math.min(page, maxPage);
  const reset = () => {
    setSearch("");
    setTriage("");
    setStage("");
    setArea("");
    setPage(0);
  };
  return (
    <>
      <Panel
        title="Priority patient queue"
        subtitle="Synthetic patients · ordered by recorded elapsed time"
        extra={
          <span className="count-label">{patients.length} active patients</span>
        }
        className="queue-panel"
      >
        <div className="queue-toolbar">
          <div className="search-field">
            <Search size={15} />
            <input
              aria-label="Search patient ID"
              placeholder="Search patient ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </div>
          <Filter className="filter-icon" size={15} />
          <select
            aria-label="Filter by triage"
            value={triage}
            onChange={(e) => {
              setTriage(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All triage levels</option>
            {Object.entries(triageLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {k} · {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by stage"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Filter by area"
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All areas</option>
            {[...new Set(patients.map((p) => p.area))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {(search || triage || stage || area) && (
            <button className="text-button" onClick={reset}>
              Reset
            </button>
          )}
        </div>
        <div className="table-scroll">
          <table className="patient-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Arrival</th>
                <th>Triage level</th>
                <th>Current stage</th>
                <th>Assigned area</th>
                <th aria-sort={descending ? "descending" : "ascending"}>
                  <button
                    className="sort-button"
                    onClick={() => setDescending(!descending)}
                  >
                    Recorded elapsed
                    {descending ? (
                      <ArrowDown size={13} />
                    ) : (
                      <ArrowUp size={13} />
                    )}
                  </button>
                </th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="patient-link"
                        onClick={() => setSelected(p)}
                      >
                        {p.id}
                      </button>
                    </td>
                    <td>{time(p.arrivalTime)}</td>
                    <td>
                      <span
                        className={`triage-badge triage-${p.triageLevel.toLowerCase()}`}
                      >
                        <i />
                        {p.triageLevel}
                        <span> · {triageLabels[p.triageLevel]}</span>
                      </span>
                    </td>
                    <td>{p.stage}</td>
                    <td>{p.area}</td>
                    <td>
                      <span
                        className={`wait-value ${p.waitingMinutes > 30 ? "long-wait" : ""}`}
                      >
                        <Clock3 size={12} />
                        {p.waitingMinutes} min
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          p.status === "Priority"
                            ? "critical"
                            : p.status === "Delayed"
                              ? "warning"
                              : "normal"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View ${p.id}`}
                        onClick={() => setSelected(p)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="empty-state">
            <Search size={25} />
            <strong>No matching patients</strong>
            <p>Try another patient ID or reset the filters.</p>
            <button className="text-button" onClick={reset}>
              Clear filters
            </button>
          </div>
        )}
        <div className="pagination">
          <span>
            Showing {filtered.length ? currentPage * pageSize + 1 : 0}–
            {Math.min((currentPage + 1) * pageSize, filtered.length)} of{" "}
            {filtered.length} patients
          </span>
          <div>
            <span>
              Page {currentPage + 1} of {maxPage + 1}
            </span>
            <button
              aria-label="Previous page"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              aria-label="Next page"
              disabled={currentPage === maxPage}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </Panel>
      {selected && (
        <PatientDetails patient={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
function PatientDetails({
  patient: p,
  onClose,
}: {
  patient: Patient;
  onClose: () => void;
}) {
  const record = useRef<HTMLElement>(null);
  useEffect(() => {
    record.current?.focus();
    record.current?.scrollIntoView({ block: "start" });
  }, [p.id]);
  const elapsed = Math.round(
    (Date.parse(p.lastUpdated) - Date.parse(p.arrivalTime)) / 60000,
  );
  const events = p.timeline ?? [
    {
      label: "Arrival recorded",
      at: p.arrivalTime,
      description: "Synthetic patient entered the emergency department.",
    },
    ...(p.stage !== "Registration"
      ? [
          {
            label: "Registration complete",
            at: new Date(
              Date.parse(p.arrivalTime) + Math.min(2, elapsed) * 60000,
            ).toISOString(),
            description:
              "Operational record created and assigned to the flow queue.",
          },
        ]
      : []),
    {
      label: `Current stage: ${p.stage}`,
      at: p.lastUpdated,
      description: `Assigned area: ${p.area}${p.assignedBed ? ` · Space ${p.assignedBed}` : ""}.`,
    },
  ];
  return (
    <section
      ref={record}
      tabIndex={-1}
      className="inline-patient-details"
      aria-labelledby="patient-record-title"
    >
      <div className="drawer-inner">
        <div className="drawer-top">
          <span className="eyebrow">PATIENT OPERATIONAL RECORD</span>
          <button
            className="icon-button"
            aria-label="Close patient details"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="drawer-patient">
          <div className="drawer-avatar">
            <UserRound size={26} />
          </div>
          <div>
            <h2 id="patient-record-title">{p.id}</h2>
            <p>Synthetic patient · No personal information</p>
          </div>
        </div>
        <Badge
          tone={
            p.status === "Priority"
              ? "critical"
              : p.status === "Delayed"
                ? "warning"
                : "normal"
          }
        >
          {p.status}
        </Badge>
        <div className="detail-grid">
          <div>
            <span>Triage level</span>
            <strong>
              {p.triageLevel} · {triageLabels[p.triageLevel]}
            </strong>
          </div>
          <div>
            <span>Current stage</span>
            <strong>{p.stage}</strong>
          </div>
          <div>
            <span>Time in current stage at snapshot</span>
            <strong>
              {p.stageMinutes === undefined
                ? "Not recorded"
                : `${p.stageMinutes} minutes`}
            </strong>
          </div>
          <div>
            <span>Total elapsed at snapshot</span>
            <strong>{elapsed} minutes</strong>
          </div>
          <div>
            <span>Assigned area</span>
            <strong>{p.area}</strong>
          </div>
          <div>
            <span>Assigned bed</span>
            <strong>{p.assignedBed || "Not assigned"}</strong>
          </div>
        </div>
        <p className="muted">
          Stage timing ends at the dataset snapshot. No transfer-request
          timestamp is available, so this is not a request-to-transfer duration.
        </p>
        <h3>Operational timeline</h3>
        <p className="muted">
          {p.timeline
            ? "Recorded synthetic stage events · Asia/Kolkata"
            : "Illustrative events from the synthetic snapshot."}
        </p>
        <ol className="timeline">
          {events.map((e, i) => (
            <li key={i}>
              <span>{time(e.at)}</span>
              <div>
                <strong>{e.label}</strong>
                <p>{e.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="drawer-disclaimer">
          This record demonstrates operational patient flow only. It does not
          contain diagnosis or treatment recommendations.
        </div>
        <button className="primary-button drawer-close" onClick={onClose}>
          Close record
        </button>
      </div>
    </section>
  );
}
