CREATE TABLE interactive_visits (
 id text PRIMARY KEY,
 request_id uuid NOT NULL UNIQUE,
 arrival_time timestamptz NOT NULL,
 arrival_method text NOT NULL CHECK (arrival_method IN ('Walk-in','Ambulance','Referral')),
 synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE interactive_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 visit_id text NOT NULL REFERENCES interactive_visits(id),
 occurred_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 stage text NOT NULL CHECK (stage IN ('Registration','Triage','Waiting','Assessment','Treatment','Awaiting Bed','Discharged','Transferred')),
 triage text NOT NULL CHECK (triage IN ('Not assessed','Red','Orange','Yellow','Green','Blue')),
 area_id text NOT NULL REFERENCES areas(area_id),
 bed_number integer CHECK(bed_number > 0)
);
CREATE INDEX interactive_events_visit ON interactive_events(visit_id,id DESC);
