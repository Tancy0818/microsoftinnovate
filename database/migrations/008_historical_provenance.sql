ALTER TABLE interactive_visits DROP CONSTRAINT interactive_visits_arrival_method_check;
ALTER TABLE interactive_visits ADD CONSTRAINT interactive_visits_arrival_method_check CHECK(arrival_method IN ('Walk-in','Ambulance','Referral','Not recorded'));
ALTER TABLE interactive_events DROP CONSTRAINT interactive_events_stage_check;
ALTER TABLE interactive_events ADD CONSTRAINT interactive_events_stage_check CHECK(stage IN ('Registration','Triage','Waiting','Assessment','Treatment','Awaiting Bed','Discharge','Departed','Discharged','Transferred','Admitted','Left before completion'));
UPDATE interactive_visits i SET arrival_method='Not recorded' FROM visits v WHERE i.id=v.visit_id;
UPDATE interactive_events e SET stage='Departed' FROM visits v WHERE e.visit_id=v.visit_id AND e.stage='Discharged' AND e.occurred_at=v.departure_time;
CREATE OR REPLACE FUNCTION seed_operational_patients() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(7234092);
 WITH added AS (
 INSERT INTO interactive_visits(id,request_id,arrival_time,arrival_method)
 SELECT visit_id,md5('acuity-baseline-'||visit_id)::uuid,arrival_time,'Not recorded' FROM visits
 ON CONFLICT(id) DO NOTHING RETURNING id
 ), events AS (
 SELECT e.*,v.departure_time FROM flow_events e JOIN added a ON a.id=e.visit_id JOIN visits v USING(visit_id)
 ), history AS (
 SELECT visit_id,stage_start AS occurred_at,stage,area_id,
 CASE WHEN bed_id IS NOT NULL THEN split_part(bed_id,'-',2)::integer END AS bed_number,event_id AS ordering
 FROM events
 UNION ALL
 SELECT visit_id,departure_time,'Departed',area_id,NULL,'zz-departure' FROM (SELECT DISTINCT ON (visit_id) * FROM events WHERE departure_time IS NOT NULL ORDER BY visit_id,stage_start DESC,event_id DESC) last_event
 )
 INSERT INTO interactive_events(visit_id,occurred_at,stage,triage,area_id,bed_number)
 SELECT h.visit_id,h.occurred_at,h.stage,v.triage_level,h.area_id,h.bed_number
 FROM history h JOIN visits v USING(visit_id) ORDER BY h.occurred_at,h.ordering;
END $$;
SELECT seed_operational_patients();

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
 CASE WHEN e.stage IN ('Discharged','Transferred','Admitted','Left before completion','Departed') THEN 0 WHEN v.id IS NOT NULL THEN 1 ELSE 0 END AS active_count,
 CASE WHEN e.stage IN ('Registration','Triage','Waiting','Awaiting Bed') THEN 1 ELSE 0 END AS waiting_count,
 CASE WHEN e.stage NOT IN ('Discharged','Transferred','Admitted','Left before completion','Departed') AND e.bed_number IS NOT NULL THEN 1 ELSE 0 END AS occupied_count,
 CASE WHEN e.stage IN ('Discharged','Transferred','Admitted','Left before completion','Departed') THEN 1 ELSE 0 END AS departed_count,
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
