import { useEffect, useRef, useState } from "react";
import { duration } from "../utils/formatters";
import {
  interactiveTriages,
  interactiveStages,
  nextStages,
  isDeparted,
  currentStageStart,
  type InteractiveData,
  type InteractiveVisit,
} from "../types/interactive";

const actionLabels: Record<string, string> = {
  Discharge: "Prepare discharge — still in ED",
  Departed: "Historical departure (outcome not recorded)",
  Registration: "Update registration",
  Triage: "Record triage",
  Waiting: "Move to waiting",
  Assessment: "Start assessment / assign bed",
  Treatment: "Start treatment",
  "Awaiting Bed": "Request admission — waiting for ward bed",
  Admitted: "Left ED — admitted to inpatient ward",
  Discharged: "Left ED — discharged",
  Transferred: "Left ED — transferred to another hospital",
  "Left before completion": "Left ED — before completing care",
};
const format = (date: string) =>
  new Date(date).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }) + " IST";
const localNow = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export async function requestInteractive(
  body?: object,
): Promise<InteractiveData> {
  const response = await fetch("/api/interactive", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Unable to load interactive patients.");
  return result;
}
export function InteractivePatients({
  onData,
  initialAdd = false,
}: {
  onData: (data: InteractiveData) => void;
  initialAdd?: boolean;
}) {
  const mounted = useRef(true);
  const editor = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [data, setData] = useState<InteractiveData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(initialAdd),
    [selected, setSelected] = useState(""),
    [showDeparted, setShowDeparted] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    requestInteractive()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          onData(d);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (selected) {
      editor.current?.focus();
      editor.current?.scrollIntoView({ block: "start" });
    }
  }, [selected]);
  function openVisit(id: string) {
    setSelected(id);
    setAdding(false);
    setMessage("");
    if (id === selected) {
      editor.current?.focus();
      editor.current?.scrollIntoView({ block: "start" });
    }
  }
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const next = await requestInteractive();
      setData(next);
      onData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setBusy(false);
    }
  }
  async function save(body: object) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await requestInteractive(body);
      if (!mounted.current) return true;
      setData(next);
      onData(next);
      setMessage(
        "Saved to PostgreSQL. Counts and patient history have been updated.",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const active =
    data?.visits.filter((v) => !isDeparted(v.events[0].stage)) ?? [];
  const visit = data?.visits.find((v) => v.id === selected);
  const matching = (showDeparted ? (data?.visits ?? []) : active).filter(
    (v) =>
      v.id.toLowerCase().includes(search.trim().toLowerCase()) &&
      (!stageFilter || v.events[0].stage === stageFilter) &&
      (!areaFilter || v.events[0].areaId === areaFilter),
  );
  return (
    <div className="patient-entry-panel">
      <section>
        <div className="dash-title">
          <div>
            <span className="dash-eyebrow">
              ACUITYCOMPASS · FICTIONAL RECORDS ONLY
            </span>
            <h2>
              {adding
                ? "Register a new arrival"
                : "Find the patient. Record the next step."}
            </h2>
            <p>
              {adding
                ? "Enter arrival details, then save to the shared patient list."
                : "Search or filter below, choose Update patient, then save their movement or departure."}
            </p>
          </div>
        </div>
        <details className="patient-data-note">
          <summary>About these synthetic records</summary>
          <p className="presentation-note">
            One combined synthetic patient list: September dataset plus website
            entries. Original dates are retained; this demo continues the
            September snapshot. Saved movements update the operational
            dashboard.
          </p>
        </details>
        <div className="operations-access">
          <span>
            <strong>
              {data ? `Updated ${format(data.asOf)}` : "Loading database…"}
            </strong>
          </span>
          <button
            disabled={busy}
            onClick={() => {
              setAdding(!adding);
              setSelected("");
            }}
          >
            {adding ? "Back to patient search" : "+ Add patient"}
          </button>
          <button disabled={busy} onClick={() => void refresh()}>
            Refresh interactive data
          </button>
        </div>
        {error && (
          <p className="dash-error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {data && adding && (
          <Register
            data={data}
            busy={busy}
            save={save}
            onDone={() => setAdding(false)}
          />
        )}
        {data && visit && (
          <div
            ref={editor}
            tabIndex={-1}
            aria-label={`Patient details for ${visit.id}`}
            className="patient-update-focus"
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelected("")}
            >
              Close patient details
            </button>
            <Update
              key={`${visit.id}-${visit.events[0].id}`}
              data={data}
              visit={visit}
              busy={busy}
              save={save}
            />
          </div>
        )}
        {data && !adding && !visit && (
          <section className="transfer-panel">
            <h2>Patient records</h2>
            <div className="patient-search-filters">
              <label>
                Search visit ID
                <input
                  type="search"
                  autoFocus={!initialAdd}
                  placeholder="Type all or part of a visit ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                Filter by stage
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                >
                  <option value="">All stages</option>
                  {interactiveStages
                    .filter((s) => showDeparted || !isDeparted(s))
                    .map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                </select>
              </label>
              <label>
                Filter by area
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                >
                  <option value="">All areas</option>
                  {data.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStageFilter("");
                  setAreaFilter("");
                }}
              >
                Clear filters
              </button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={showDeparted}
                onChange={(e) => {
                  setShowDeparted(e.target.checked);
                  setStageFilter("");
                }}
              />{" "}
              Include all departed visits
            </label>
            <p role="status">
              Showing {matching.length} of{" "}
              {(showDeparted ? data.visits : active).length}{" "}
              {showDeparted ? "recorded" : "active"} patients
            </p>
            <div className="table-scroll">
              <table className="dash-data-table">
                <thead>
                  <tr>
                    <th>Visit</th>
                    <th>Arrival</th>
                    <th>Triage</th>
                    <th>Stage</th>
                    <th>Area / bed</th>
                    <th>Time in stage</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {matching.map((v) => {
                    const e = v.events[0];
                    return (
                      <tr key={v.id}>
                        <td>{v.id}</td>
                        <td>{format(v.arrivalTime)}</td>
                        <td>{e.triage}</td>
                        <td>
                          {e.stage}
                          {e.destination ? ` · ${e.destination}` : ""}
                        </td>
                        <td>
                          {e.area}
                          {e.bed ? ` / Bed ${e.bed}` : ""}
                        </td>
                        <td>
                          {isDeparted(e.stage)
                            ? "Departed"
                            : duration(
                                Math.max(
                                  0,
                                  Math.floor(
                                    (Date.parse(data.asOf) -
                                      Date.parse(currentStageStart(v))) /
                                      60000,
                                  ),
                                ),
                              )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="patient-link"
                            disabled={busy}
                            aria-label={`${isDeparted(e.stage) ? "View history" : "Update patient"} ${v.id}`}
                            onClick={() => openVisit(v.id)}
                          >
                            {isDeparted(e.stage)
                              ? "View history"
                              : "Update patient"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!matching.length && (
              <p>
                {search || stageFilter || areaFilter
                  ? "No patients match these filters. Clear filters or include departed visits to widen your search."
                  : "No patients yet. Select Add patient to register a fictional visit."}
              </p>
            )}
          </section>
        )}
        {data && !adding && !visit && (
          <section className="transfer-panel">
            <h2>Combined bed capacity</h2>
            <p>
              Includes original dataset patients still in the ED and new website
              entries.
            </p>
            <div className="table-scroll">
              <table className="dash-data-table">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Occupied</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {data.areas
                    .filter((a) => a.bedArea)
                    .map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td>{a.occupied}</td>
                        <td>{a.capacity - a.occupied}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
type FormProps = {
  data: InteractiveData;
  busy: boolean;
  save: (body: object) => Promise<boolean>;
};
function Register({
  data,
  busy,
  save,
  onDone,
}: FormProps & { onDone: () => void }) {
  const requestId = useRef(crypto.randomUUID());
  const [arrival, setArrival] = useState(localNow),
    [method, setMethod] = useState("Walk-in"),
    [triage, setTriage] = useState("Not assessed"),
    [area, setArea] = useState(data.areas.find((a) => !a.bedArea)?.id ?? "");
  return (
    <form
      className="followup-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await save({
            kind: "register",
            requestId: requestId.current,
            arrivalTime: new Date(arrival).toISOString(),
            arrivalMethod: method,
            triage,
            areaId: area,
          })
        )
          onDone();
      }}
    >
      <h2>Add fictional patient</h2>
      <p>
        A visit ID is generated automatically. The patient starts at
        Registration without a bed. Triage is entered by a person, not
        calculated by the application.
      </p>
      <fieldset disabled={busy}>
        <label>
          Arrival time (this laptop's timezone)
          <input
            type="datetime-local"
            required
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
          />
        </label>
        <label>
          Arrival method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {["Walk-in", "Ambulance", "Referral"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Triage category
          <select value={triage} onChange={(e) => setTriage(e.target.value)}>
            {interactiveTriages.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Initial area
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            {data.areas
              .filter((a) => !a.bedArea)
              .map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </label>
        <div className="followup-buttons">
          <button className="primary-button">
            {busy ? "Saving…" : "Register patient"}
          </button>
          <button type="button" onClick={onDone}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function Update({
  data,
  visit,
  busy,
  save,
}: FormProps & { visit: InteractiveVisit }) {
  const current = visit.events[0];
  const [stage, setStage] = useState(current.stage),
    [triage, setTriage] = useState(current.triage),
    [area, setArea] = useState(current.areaId),
    [bed, setBed] = useState(current.bed ? String(current.bed) : ""),
    [destination, setDestination] = useState(current.destination ?? ""),
    [confirmed, setConfirmed] = useState(false);
  const selectedArea = data.areas.find((a) => a.id === area);
  return (
    <section className="followup-editor">
      <h2>{visit.id}</h2>
      <p>
        {visit.arrivalMethod} · Arrival {format(visit.arrivalTime)}
      </p>
      {!isDeparted(current.stage) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await save({
              kind: "event",
              patientId: visit.id,
              expectedId: current.id,
              stage,
              triage,
              destination,
              areaId: area,
              bed: isDeparted(stage) ? null : bed ? Number(bed) : null,
            });
          }}
        >
          <p>
            Requesting admission keeps the patient in the ED and retains their
            assigned bed. Record departure only when they physically leave.
            Every saved update is timestamped and appears in the history below.
          </p>
          <fieldset disabled={busy}>
            <label>
              Coordinator action
              <select
                value={stage}
                onChange={(e) => {
                  setStage(e.target.value as typeof stage);
                  setConfirmed(false);
                }}
              >
                {nextStages[current.stage].map((v) => (
                  <option key={v} value={v}>
                    {actionLabels[v]}
                  </option>
                ))}
              </select>
            </label>
            {["Awaiting Bed", "Admitted", "Transferred"].includes(stage) && (
              <label>
                {stage === "Transferred"
                  ? "Destination hospital"
                  : "Destination ward"}
                {stage === "Awaiting Bed"
                  ? " (optional until transfer)"
                  : " (required)"}
                <input
                  value={destination}
                  maxLength={120}
                  required={stage !== "Awaiting Bed"}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={
                    stage === "Transferred"
                      ? "e.g. Central Hospital"
                      : "e.g. Medical ward 2"
                  }
                />
              </label>
            )}
            <label>
              Recorded triage
              <select
                value={triage}
                onChange={(e) => setTriage(e.target.value as typeof triage)}
              >
                {interactiveTriages.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Assigned area
              <select
                disabled={isDeparted(stage)}
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setBed("");
                }}
              >
                {data.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assigned bed
              <select
                disabled={!selectedArea?.bedArea || isDeparted(stage)}
                value={isDeparted(stage) ? "" : bed}
                onChange={(e) => setBed(e.target.value)}
              >
                <option value="">Not assigned</option>
                {selectedArea?.bedArea &&
                  Array.from(
                    { length: selectedArea.capacity },
                    (_, i) => i + 1,
                  ).map((n) => {
                    const occupied = data.visits.some(
                      (v) =>
                        v.id !== visit.id &&
                        !isDeparted(v.events[0].stage) &&
                        v.events[0].areaId === area &&
                        v.events[0].bed === n,
                    );
                    return (
                      <option key={n} value={n} disabled={occupied}>
                        Bed {n}
                        {occupied ? " · occupied" : ""}
                      </option>
                    );
                  })}
              </select>
            </label>
            {isDeparted(stage) && (
              <label>
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                Confirm the patient has physically left the ED. Saving closes
                this visit and releases its bed.
              </label>
            )}
            <div className="followup-buttons">
              <button className="primary-button">
                {busy
                  ? "Saving…"
                  : isDeparted(stage)
                    ? "Record departure"
                    : "Save patient update"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <h3>Recorded event history</h3>
      <ol className="timeline">
        {visit.events.map((e) => (
          <li key={e.id}>
            <span>{format(e.occurredAt)}</span>
            <div>
              <strong>
                {e.stage} · {e.triage}
              </strong>
              <p>
                {e.area}
                {e.bed ? ` · Bed ${e.bed}` : ""}
                {e.destination ? ` · Destination: ${e.destination}` : ""}
              </p>
              <small>Entered {format(e.recordedAt)}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
