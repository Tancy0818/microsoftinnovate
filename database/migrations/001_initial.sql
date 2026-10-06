CREATE TABLE IF NOT EXISTS dataset_imports (
  id text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now(),
  source_label text NOT NULL, snapshot_time timestamptz NOT NULL, synthetic boolean NOT NULL CHECK(synthetic)
);
CREATE TABLE IF NOT EXISTS areas (
 area_id text PRIMARY KEY, area_name text NOT NULL UNIQUE,
 staffed_capacity integer NOT NULL CHECK(staffed_capacity > 0), is_bed_area integer NOT NULL CHECK(is_bed_area IN (0,1))
);
CREATE TABLE IF NOT EXISTS dates (report_date date PRIMARY KEY, day_number integer NOT NULL, day_name text NOT NULL);
CREATE TABLE IF NOT EXISTS visits (
 visit_id text PRIMARY KEY, arrival_time timestamptz NOT NULL, arrival_date date NOT NULL REFERENCES dates,
 departure_time timestamptz, departure_date date, triage_level text NOT NULL CHECK(triage_level IN ('Red','Orange','Yellow','Green','Blue')),
 arrival_condition text NOT NULL, first_care_area_id text NOT NULL REFERENCES areas,
 first_assessment_time timestamptz, wait_to_assessment_minutes numeric, wait_elapsed_minutes numeric NOT NULL CHECK(wait_elapsed_minutes >= 0),
 ed_stay_minutes numeric, status_at_cutoff text NOT NULL, stage_at_cutoff text NOT NULL, area_at_cutoff text,
 synthetic integer NOT NULL CHECK(synthetic=1), CHECK(departure_time IS NULL OR departure_time >= arrival_time)
);
CREATE TABLE IF NOT EXISTS flow_events (
 event_id text PRIMARY KEY, visit_id text NOT NULL REFERENCES visits, stage text NOT NULL CHECK(stage IN ('Registration','Triage','Waiting','Assessment','Treatment','Awaiting Bed','Discharge')),
 area_id text NOT NULL REFERENCES areas, bed_id text, stage_start timestamptz NOT NULL, stage_end timestamptz,
 observed_minutes numeric NOT NULL CHECK(observed_minutes >= 0), synthetic integer NOT NULL CHECK(synthetic=1),
 CHECK(stage_end IS NULL OR stage_end > stage_start)
);
CREATE INDEX IF NOT EXISTS flow_events_visit ON flow_events(visit_id,stage_start);
CREATE INDEX IF NOT EXISTS flow_events_interval ON flow_events(stage_start,stage_end);
CREATE TABLE IF NOT EXISTS department_hourly (
 hour_start timestamptz PRIMARY KEY, snapshot_time timestamptz NOT NULL UNIQUE, report_date date NOT NULL REFERENCES dates,
 hour_of_day integer NOT NULL CHECK(hour_of_day BETWEEN 0 AND 23), arrivals integer NOT NULL CHECK(arrivals >= 0), departures integer NOT NULL CHECK(departures >= 0),
 active_patients integer NOT NULL CHECK(active_patients >= 0), patients_waiting integer NOT NULL CHECK(patients_waiting >= 0),
 average_elapsed_wait_minutes numeric NOT NULL CHECK(average_elapsed_wait_minutes >= 0), occupied_beds integer NOT NULL CHECK(occupied_beds >= 0),
 staffed_beds integer NOT NULL CHECK(staffed_beds > 0), high_acuity_waiting_over_15 integer NOT NULL, synthetic integer NOT NULL CHECK(synthetic=1),
 CHECK(occupied_beds <= staffed_beds), CHECK(snapshot_time = hour_start + interval '1 hour')
);
CREATE TABLE IF NOT EXISTS area_capacity_hourly (
 snapshot_time timestamptz NOT NULL REFERENCES department_hourly(snapshot_time), report_date date NOT NULL REFERENCES dates,
 area_id text NOT NULL REFERENCES areas, staffed_capacity integer NOT NULL CHECK(staffed_capacity > 0), occupied integer NOT NULL CHECK(occupied >= 0),
 waiting integer NOT NULL CHECK(waiting >= 0), overflow integer NOT NULL CHECK(overflow >= 0), is_bed_area integer NOT NULL CHECK(is_bed_area IN(0,1)),
 synthetic integer NOT NULL CHECK(synthetic=1), PRIMARY KEY(snapshot_time,area_id), CHECK(is_bed_area=0 OR occupied <= staffed_capacity)
);
CREATE TABLE IF NOT EXISTS operational_actions (
 snapshot_time timestamptz NOT NULL REFERENCES department_hourly(snapshot_time), alert_id text NOT NULL,
 acknowledged boolean NOT NULL DEFAULT false, task_status text NOT NULL DEFAULT 'Open' CHECK(task_status IN('Open','In Progress','Completed')),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(snapshot_time,alert_id)
);
CREATE SCHEMA IF NOT EXISTS reporting;
CREATE OR REPLACE VIEW reporting.department_hourly AS SELECT * FROM public.department_hourly;
CREATE OR REPLACE VIEW reporting.area_capacity_hourly AS SELECT c.*,a.area_name FROM public.area_capacity_hourly c JOIN public.areas a USING(area_id);
CREATE OR REPLACE VIEW reporting.latest_patients AS
SELECT v.visit_id, v.arrival_time, v.triage_level, e.stage, a.area_name, e.bed_id,
 s.snapshot_time, extract(epoch FROM (s.snapshot_time-v.arrival_time))/60 AS elapsed_minutes
FROM (SELECT max(snapshot_time) AS snapshot_time FROM public.department_hourly) s
JOIN public.flow_events e ON e.stage_start < s.snapshot_time AND (e.stage_end IS NULL OR e.stage_end >= s.snapshot_time)
JOIN public.visits v USING(visit_id) JOIN public.areas a USING(area_id);
