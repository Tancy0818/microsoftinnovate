CREATE OR REPLACE VIEW reporting.planner_outcomes AS
 SELECT id::text, created_at, status, selected, started_at, completed_at,
 (result->>'startingQueue')::integer AS starting_queue,
 (result->>'expectedArrivals')::numeric AS expected_arrivals,
 (outcome->>'queue')::integer AS observed_queue,
 (outcome->>'active')::integer AS observed_active,
 (outcome->>'elapsedMinutes')::numeric AS elapsed_minutes,
 outcome->>'note' AS coordinator_note,
 (SELECT (o->>'queue')::numeric FROM jsonb_array_elements(result->'options') o WHERE o->>'id'=selected) AS predicted_queue,
 forecast->>'model' AS demand_model,
 (forecast->>'testMae')::numeric AS demand_test_mae,
 (forecast->>'testBaselineMae')::numeric AS baseline_test_mae
 FROM planner_runs;
