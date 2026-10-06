UPDATE interactive_events e SET area_id=last_event.area_id
FROM (SELECT DISTINCT ON (visit_id) visit_id,area_id FROM flow_events ORDER BY visit_id,stage_start DESC,event_id DESC) last_event
WHERE e.visit_id=last_event.visit_id AND e.stage='Departed';
