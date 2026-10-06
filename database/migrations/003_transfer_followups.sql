-- Append-only follow-up history on historical snapshots; no clinical events are changed.
CREATE TABLE transfer_followups (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 snapshot_time timestamptz NOT NULL REFERENCES department_hourly(snapshot_time),
 visit_id text NOT NULL REFERENCES visits(visit_id),
 blocker text NOT NULL CHECK (blocker IN ('Unknown','Receiving team acceptance','Bed preparation','Transport','Other')),
 owner text NOT NULL CHECK (owner IN ('Unassigned','ED coordinator','Receiving team','Bed management','Transport team')),
 status text NOT NULL CHECK (status IN ('Open','In Progress','Closed')),
 note text NOT NULL CHECK (length(note) BETWEEN 1 AND 500),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transfer_followups_snapshot_visit ON transfer_followups(snapshot_time,visit_id,id DESC);
