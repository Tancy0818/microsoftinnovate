CREATE OR REPLACE VIEW reporting.operational_daily AS
WITH events AS (
 SELECT (arrival_time AT TIME ZONE 'Asia/Kolkata')::date AS report_date,1 AS arrivals,0 AS departures FROM interactive_visits
 UNION ALL
 SELECT latest_event_time::date,0,1 FROM reporting.interactive_patients WHERE departed_count=1
), bounds AS (SELECT min(report_date) AS first_date,max(report_date) AS last_date FROM events), days AS (
 SELECT generate_series(first_date,last_date,interval '1 day')::date AS report_date FROM bounds
)
SELECT d.report_date,coalesce(sum(e.arrivals),0)::integer AS arrivals,coalesce(sum(e.departures),0)::integer AS departures
FROM days d LEFT JOIN events e USING(report_date) GROUP BY d.report_date;
CREATE OR REPLACE VIEW reporting.operational_areas AS
SELECT a.area_name,a.staffed_capacity,coalesce(sum(p.occupied_count),0)::integer AS occupied
FROM areas a LEFT JOIN reporting.interactive_patients p ON p.area_name=a.area_name
WHERE a.is_bed_area=1 GROUP BY a.area_name,a.staffed_capacity;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='acuity_report') THEN
 GRANT SELECT ON reporting.operational_daily,reporting.operational_areas TO acuity_report;
 END IF;
END $$;
