ALTER TABLE interactive_events ADD COLUMN destination text CHECK (length(destination)<=120);
ALTER TABLE interactive_events DROP CONSTRAINT interactive_events_stage_check;
ALTER TABLE interactive_events ADD CONSTRAINT interactive_events_stage_check CHECK (stage IN ('Registration','Triage','Waiting','Assessment','Treatment','Awaiting Bed','Discharged','Transferred','Admitted','Left before completion'));
-- Preserve existing historical transfers, which did not record a destination.
CREATE OR REPLACE VIEW reporting.interactive_patients AS
WITH latest AS (
 SELECT DISTINCT ON (visit_id) * FROM public.interactive_events ORDER BY visit_id,id DESC
), capacity AS (
 SELECT sum(staffed_capacity)::integer AS staffed_beds FROM public.areas WHERE is_bed_area=1
)
SELECT v.id AS visit_id,
 v.arrival_time AT TIME ZONE 'Asia/Kolkata' AS arrival_time,
 v.arrival_method, e.stage, e.triage AS triage_level, a.area_name, e.bed_number,
 e.occurred_at AT TIME ZONE 'Asia/Kolkata' AS latest_event_time,
 CASE WHEN e.stage IN ('Discharged','Transferred','Admitted','Left before completion') THEN 0 WHEN v.id IS NOT NULL THEN 1 ELSE 0 END AS active_count,
 CASE WHEN e.stage IN ('Registration','Triage','Waiting','Awaiting Bed') THEN 1 ELSE 0 END AS waiting_count,
 CASE WHEN e.stage NOT IN ('Discharged','Transferred','Admitted','Left before completion') AND e.bed_number IS NOT NULL THEN 1 ELSE 0 END AS occupied_count,
 CASE WHEN e.stage IN ('Discharged','Transferred','Admitted','Left before completion') THEN 1 ELSE 0 END AS departed_count,
 capacity.staffed_beds,
 CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' AS refreshed_at
FROM capacity
LEFT JOIN public.interactive_visits v ON true
LEFT JOIN latest e ON e.visit_id=v.id
LEFT JOIN public.areas a ON a.area_id=e.area_id;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='acuity_report') THEN
  GRANT SELECT ON reporting.interactive_patients TO acuity_report;
 END IF;
END $$;
