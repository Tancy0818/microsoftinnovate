import { useState } from "react";
import type {
  DashboardData,
  FollowupInput,
  TransferFollowup,
} from "../types/dashboard";
const date = (value: string) =>
  new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }) +
  " IST";
type Save = (input: FollowupInput, expectedId: number) => Promise<void>;

export function TransferFollowups({
  data,
  database,
  onSave,
}: {
  data: DashboardData;
  database: boolean;
  onSave: Save;
}) {
  const patients = data.patients.filter((p) => p.stage === "Awaiting Bed");
  const [selected, setSelected] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const history = data.followups ?? [];
  const latest = (id: string) => history.find((f) => f.patientId === id);
  const visible = patients.filter(
    (p) => !openOnly || latest(p.id)?.status !== "Closed",
  );
  const patient = patients.find((p) => p.id === selected);
  const current = patient ? latest(patient.id) : undefined;
  return (
    <section className="transfer-panel" aria-labelledby="transfer-title">
      <div className="transfer-heading">
        <div>
          <span className="dash-eyebrow">COORDINATION & HANDOVER</span>
          <h2 id="transfer-title">Transfer follow-up</h2>
          <p>
            {patients.length} patients awaiting a bed at this snapshot ·{" "}
            {patients.filter((p) => latest(p.id)?.status !== "Closed").length}{" "}
            needing follow-up
          </p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />{" "}
          Open handover items only
        </label>
      </div>
      <p className="muted">
        {database
          ? "Notes are saved to PostgreSQL against this historical snapshot."
          : "Demo notes are temporary and reset when you change the scenario."}{" "}
        Blockers are user-recorded, never inferred from occupancy.
      </p>
      {!visible.length ? (
        <p>No matching transfer follow-ups in this snapshot.</p>
      ) : (
        <div className="table-scroll">
          <table className="dash-data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Time in stage</th>
                <th>Recorded blocker</th>
                <th>Responsible team</th>
                <th>Follow-up</th>
                <th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const f = latest(p.id);
                return (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="patient-link"
                        onClick={() => setSelected(p.id)}
                      >
                        {p.id}
                      </button>
                    </td>
                    <td>
                      {p.stageMinutes === undefined
                        ? "—"
                        : `${p.stageMinutes} min`}
                    </td>
                    <td>{f?.blocker ?? "Not recorded"}</td>
                    <td>{f?.owner ?? "Unassigned"}</td>
                    <td>{f?.status ?? "Not started"}</td>
                    <td>{f ? date(f.recordedAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {patient && (
        <FollowupEditor
          key={`${patient.id}-${current?.id ?? 0}`}
          patientId={patient.id}
          current={current}
          onClose={() => setSelected("")}
          onSave={onSave}
        />
      )}
      {patient && (
        <details className="followup-history">
          <summary>
            Update history for {patient.id} (
            {history.filter((f) => f.patientId === patient.id).length})
          </summary>
          {history
            .filter((f) => f.patientId === patient.id)
            .map((f) => (
              <article key={f.id}>
                <strong>
                  {f.status} · {f.owner}
                </strong>
                <p>
                  {f.blocker}: {f.note}
                </p>
                <small>{date(f.recordedAt)} · user-entered follow-up</small>
              </article>
            ))}
        </details>
      )}
    </section>
  );
}

function FollowupEditor({
  patientId,
  current,
  onSave,
  onClose,
}: {
  patientId: string;
  current?: TransferFollowup;
  onSave: Save;
  onClose: () => void;
}) {
  const [blocker, setBlocker] = useState<FollowupInput["blocker"]>(
    current?.blocker ?? "Unknown",
  );
  const [owner, setOwner] = useState<FollowupInput["owner"]>(
    current?.owner ?? "Unassigned",
  );
  const [status, setStatus] = useState<FollowupInput["status"]>(
    current?.status ?? "Open",
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="followup-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave(
            { patientId, blocker, owner, status, note },
            current?.id ?? 0,
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to save.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Update {patientId}</h3>
      <p>
        Closing a follow-up records completion of coordination work. It does not
        record a patient transfer or free a bed.
      </p>
      <fieldset disabled={busy}>
        <label>
          Recorded blocker
          <select
            value={blocker}
            onChange={(e) => setBlocker(e.target.value as typeof blocker)}
          >
            {[
              "Unknown",
              "Receiving team acceptance",
              "Bed preparation",
              "Transport",
              "Other",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Responsible team
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as typeof owner)}
          >
            {[
              "Unassigned",
              "ED coordinator",
              "Receiving team",
              "Bed management",
              "Transport team",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Follow-up status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            {["Open", "In Progress", "Closed"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="followup-note">
          Update / handover note
          <textarea
            required
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Record the reason or latest follow-up. Use fictional details only."
          />
        </label>
        <div className="followup-buttons">
          <button
            className="primary-button"
            disabled={
              !note.trim() || (status !== "Open" && owner === "Unassigned")
            }
          >
            {busy ? "Saving…" : "Save follow-up"}
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            Close editor
          </button>
        </div>
      </fieldset>
      {status !== "Open" && owner === "Unassigned" && (
        <p role="status">
          Assign a responsible team before progressing or closing this
          follow-up.
        </p>
      )}
      {error && (
        <p role="alert" className="dash-error">
          {error}
        </p>
      )}
    </form>
  );
}
