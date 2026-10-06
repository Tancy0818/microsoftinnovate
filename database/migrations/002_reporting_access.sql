-- Local setup creates the reporting role. External deployments can provision
-- their own read-only role separately without making migrations fail.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='acuity_report') THEN
  GRANT USAGE ON SCHEMA public,reporting TO acuity_report;
  GRANT SELECT ON areas,dates,visits,flow_events,department_hourly,area_capacity_hourly TO acuity_report;
  GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO acuity_report;
 END IF;
END $$;
