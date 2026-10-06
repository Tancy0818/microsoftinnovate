# AcuityCompass synthetic dataset

Entirely fictional emergency-department operations. No patient, hospital or clinical source data was used. These distributions are assumptions for a student demonstration, not a validated model of hospital performance.

Period: **29 August–27 September 2026**, ending immediately before **28 September 2026, 00:00**, Asia/Kolkata (UTC+05:30). Fixed seed: **28092026**. The starting census is deliberately empty, so the first few hours are a simulation warm-up.

## Files and grain

| File | One row represents | Rows |
|---|---|---:|
| visits.csv | One fictional ED encounter, not a person with repeat visits | 3,015 |
| flow_events.csv | One observed stage interval for an encounter | 19,249 |
| area_capacity_hourly.csv | One area at one hourly snapshot | 4,320 |
| department_hourly.csv | One department hour and its ending snapshot | 720 |
| areas.csv | One ED area | 6 |
| dates.csv | One reporting date | 30 |

`dataset.json` contains the same tables for application/backend ingestion. `manifest.json` records the fixed period, seed, row counts and validation outcome. The Excel workbook in `outputs/acuity-data/` contains the same six tables for convenient Power BI import.

The React page now connects through the backend to this dataset in PostgreSQL. Select **PostgreSQL · Synthetic dataset**. The three built-in scenario fixtures remain separate labelled demos. See `docs/LOCAL-DEVELOPMENT.md` for import and startup instructions.

## Definitions and assumptions

- All timestamps in CSV are local wall-clock values in Asia/Kolkata, written `YYYY-MM-DD HH:mm:ss`; there is no implicit machine-local timezone conversion. Import them as Date/Time in Power BI. For PostgreSQL integration, explicitly interpret them in Asia/Kolkata before storing UTC timestamps.
- Hours cover `[hour_start, snapshot_time)`. Snapshots describe conditions immediately before `snapshot_time`. An event starting exactly at a boundary belongs to the next interval; a departure at that boundary has not yet been counted by the ending snapshot.
- `report_date` is the date of `hour_start`. Consequently, the midnight snapshot belongs to the previous reporting day's final hour.
- `synthetic = 1` identifies generated records. IDs are artificial. There are no names, addresses, birth dates, diagnoses, treatment recommendations or other personal identifiers.
- Each visit moves continuously through registration, triage, waiting, assessment, treatment, optional waiting for a boarding bed, and discharge. Every stage start is followed by the next stage without an unexplained gap.
- Low-acuity waits, time in staffed beds, arrival volume and boarding transfers are synthetic assumptions. High Demand is an **arrival-period condition**, not a prediction or clinical classification. Selected daytime periods have increased arrivals and longer service times.
- A simple deterministic scheduler assigns available beds. Staffed capacities are fixed at 4 Resuscitation, 18 Examination, 12 Observation and 10 Boarding beds. Total staffed-bed denominator: **44**.
- Triage and Waiting Area have 6 and 24 spaces respectively. Their occupancy can exceed capacity and is explicitly recorded in `overflow`. Staffed bed areas never exceed capacity.
- A patient can occupy a boarding bed while still awaiting the next destination. Thus `waiting` overlaps occupancy; do not add those columns as separate populations.
- Waiting includes Registration, Triage, Waiting and Awaiting Bed. `average_elapsed_wait_minutes` is **elapsed time since arrival among patients currently in those stages**, including time previously spent in care for a boarding patient. It is not time spent solely in the current stage.
- `wait_to_assessment_minutes` measures arrival to first assessment for visits whose first assessment has occurred before cutoff. It is blank when assessment has not yet happened; do not replace that blank with zero.
- `wait_elapsed_minutes` is elapsed time up to first assessment, capped at the cutoff for patients still awaiting assessment.
- `ed_stay_minutes` is arrival to departure, present only for completed visits. Departures after the cutoff are not exported as known outcomes.
- `stage_end` is blank for an interval still open at cutoff; `observed_minutes` counts only the observed portion up to cutoff.
- `high_acuity_waiting_over_15` counts Red/Orange patients in waiting stages with more than 15 minutes elapsed since arrival. This is a demonstration operational flag, not a clinical standard.
- Bed occupancy and active patient counts are **snapshots**. Never sum them across dates as a count of patients or beds. Use the latest snapshot or an explicitly labelled time average.

## Key columns

`visits`: `visit_id` is unique. `arrival_date` and `departure_date` support date relationships. `triage_level` is Red/Orange/Yellow/Green/Blue. `first_care_area_id` is the first assigned bed area. `status_at_cutoff`, `stage_at_cutoff` and `area_at_cutoff` describe the end-of-period state, not the state on every historical reporting day.

`flow_events`: `event_id` is unique; `visit_id` links to visits and `area_id` to areas. `stage_start`, `stage_end` and `observed_minutes` describe an interval. `bed_id` is blank for non-bed stages. A visit appears on multiple rows; row count is not a patient count.

`area_capacity_hourly`: key is `(snapshot_time, area_id)`. `staffed_capacity`, `occupied`, `waiting`, `overflow` are integer counts. `is_bed_area` excludes triage/waiting spaces from staffed-bed calculations.

`department_hourly`: `hour_start` is unique. `arrivals` and `departures` are additive hourly flows. `active_patients`, `patients_waiting`, `occupied_beds`, `staffed_beds` and `high_acuity_waiting_over_15` are ending snapshots. `average_elapsed_wait_minutes` is an hourly mean, not a monthly patient-weighted mean.

`areas`: `area_id` is unique. `area_name`, `staffed_capacity`, `is_bed_area` describe fixed capacity assumptions. `dates`: `report_date` is unique; `day_number` is the ordinal day of this dataset and `day_name` is the weekday.

## Reproduce and validate

From the project directory, run:

```sh
node scripts/generate-dataset.mjs
```

This rewrites only generated files in `dataset/`. It uses a fixed seed and fixed period and checks unique IDs, continuous visit timelines, non-overlapping bed allocations, capacity limits, and hourly conservation (`previous census + arrivals - departures = current census`). It does not rewrite the separately exported Excel workbook. After changing the generator, import the regenerated CSVs into Power BI or re-export the workbook before using it.

See `docs/POWER-BI-SETUP.md` for the reporting model and measures. PostgreSQL and Power BI are not installed, connected or published by generating these files.

