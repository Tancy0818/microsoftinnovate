CREATE TABLE planner_settings (
 id integer PRIMARY KEY CHECK(id=1), version integer NOT NULL DEFAULT 1,
 settings jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE planner_runs (
 id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'compared' CHECK(status IN ('compared','started','completed','cancelled')),
 selected text, started_at timestamptz, completed_at timestamptz,
 settings jsonb NOT NULL, result jsonb NOT NULL, forecast jsonb,
 source_fingerprint text NOT NULL, outcome jsonb
);
CREATE VIEW reporting.planner_outcomes AS
 SELECT id::text, created_at, status, selected, started_at, completed_at,
 (result->>'startingQueue')::integer AS starting_queue,
 (result->>'expectedArrivals')::numeric AS expected_arrivals,
 (outcome->>'queue')::integer AS observed_queue,
 (outcome->>'active')::integer AS observed_active,
 (outcome->>'elapsedMinutes')::numeric AS elapsed_minutes,
 outcome->>'note' AS coordinator_note
 FROM planner_runs;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='acuity_report') THEN
 GRANT SELECT ON reporting.planner_outcomes TO acuity_report;
 END IF;
END $$;
