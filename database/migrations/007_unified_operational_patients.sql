-- Continue the historical dataset in the editable operational ledger, once per visit.
ALTER TABLE interactive_events DROP CONSTRAINT interactive_events_stage_check;
ALTER TABLE interactive_events ADD CONSTRAINT interactive_events_stage_check CHECK(stage IN ('Registration','Triage','Waiting','Assessment','Treatment','Awaiting Bed','Discharge','Discharged','Transferred','Admitted','Left before completion'));
CREATE OR REPLACE FUNCTION seed_operational_patients() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(7234092);
 WITH added AS (
 INSERT INTO interactive_visits(id,request_id,arrival_time,arrival_method)
 SELECT visit_id,md5('acuity-baseline-'||visit_id)::uuid,arrival_time,'Referral' FROM visits
 ON CONFLICT(id) DO NOTHING RETURNING id
 ), events AS (
 SELECT e.*,v.departure_time FROM flow_events e JOIN added a ON a.id=e.visit_id JOIN visits v USING(visit_id)
 ), history AS (
 SELECT visit_id,stage_start AS occurred_at,stage,area_id,
 CASE WHEN bed_id IS NOT NULL THEN split_part(bed_id,'-',2)::integer END AS bed_number,event_id AS ordering
 FROM events
 UNION ALL
 SELECT DISTINCT ON (visit_id) visit_id,departure_time,'Discharged',area_id,NULL,'zz-departure'
 FROM events WHERE departure_time IS NOT NULL ORDER BY visit_id,ordering
 )
 INSERT INTO interactive_events(visit_id,occurred_at,stage,triage,area_id,bed_number)
 SELECT h.visit_id,h.occurred_at,h.stage,v.triage_level,h.area_id,h.bed_number
 FROM history h JOIN visits v USING(visit_id) ORDER BY h.occurred_at,h.ordering;
END $$;
SELECT seed_operational_patients();
