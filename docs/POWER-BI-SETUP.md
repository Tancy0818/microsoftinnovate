# Power BI setup for AcuityCompass

## Architecture

Use one dataset for both products:

```text
Synthetic records → PostgreSQL → Backend API → React dashboard
                         └────→ Power BI report
```

PostgreSQL remains suitable. Power BI's native PostgreSQL connector supports Import and DirectQuery. Start with **Import** for a predictable student presentation. Later, configure refresh when the database is running. Power BI Service access to a local PostgreSQL instance may require an on-premises data gateway; Desktop on the same computer can connect directly.

Microsoft references:
- [PostgreSQL connector and connectivity modes](https://learn.microsoft.com/en-us/power-query/connectors/postgresql)
- [Power BI model relationships and star schemas](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema)

## Start now without a database

1. In Power BI Desktop, choose **Get data → Excel workbook** and open `outputs/acuity-data/AcuityCompass-synthetic-data.xlsx`. Alternatively, use **Text/CSV** to import files from `dataset/`.
2. Load `department_hourly`, `area_capacity_hourly`, `areas`, `dates` and `visits`. `flow_events` is optional for deeper stage-duration analysis; do not load it into the basic report model yet.
3. In Power Query, promote the first row to headers if needed, then name each query exactly as its filename without the extension. Remove any duplicate automatic date tables from the model where appropriate; use the explicit `dates` table.
4. Set IDs and categories to Text; dates to Date; timestamps to Date/Time; counts to Whole number; duration/average columns to Decimal number. Preserve missing assessment/departure/stage-end fields as null. CSV timestamps are Asia/Kolkata wall-clock values. The workbook uses equivalent native Excel date values.
5. Apply changes and create the relationships below. Use **one-to-many, single-direction** filtering from dimension to fact. Disable/remove conflicting auto-detected relationships.

| One side | Many side | Active? |
|---|---|---|
| dates[report_date] | department_hourly[report_date] | Yes |
| dates[report_date] | area_capacity_hourly[report_date] | Yes |
| dates[report_date] | visits[arrival_date] | Yes |
| areas[area_id] | area_capacity_hourly[area_id] | Yes |

Keep the first report simple: a date slicer affects all displayed trends; area is used on the capacity chart's axis. Do not join fact tables directly. The basic model intentionally does not filter department-wide metrics by area. Visit measures use the **arrival cohort** selected by the date slicer; departures are counted from the hourly table by actual departure hour.

If you later add `flow_events`, link visits[visit_id] → flow_events[visit_id] and areas[area_id] → flow_events[area_id], both single-direction. Avoid also linking areas to visits because that introduces an alternative filter path. Filtering flow events through visits' arrival date measures events for the selected arrival cohort, not events occurring on the selected date. Use a separate event-date dimension if occurrence-date analysis is needed.

## One report page for judges

Title: **AcuityCompass — ED activity overview**.

Put **Synthetic demonstration data · 29 Aug–27 Sep 2026 · Asia/Kolkata** under the title.

1. A date-range slicer.
2. Four cards: total arrivals in the period, patients at the latest selected snapshot, latest waiting count, latest staffed-bed occupancy.
3. A line chart of arrivals and departures by `department_hourly[hour_start]` (or `dates[report_date]` for daily totals).
4. A bar chart of latest bed occupancy by `areas[area_name]`, filtered to `areas[is_bed_area] = 1`.
5. A bar chart of visit counts by `visits[triage_level]`, titled **Urgency of arrivals in the selected period**.
6. A small card showing `Latest snapshot` so an old dataset is not presented as live.

Use the same navy, blue, amber and red as the React UI. Keep this as one Power BI report page. It can initially be demonstrated in Power BI Desktop alongside the existing single-page React UI. No embedding is required to prove the data/reporting workflow.

## DAX measures

Create the following measures individually. Format occupancy measures as percentages and timestamps as `dd MMM yyyy HH:mm`.

```dax
Total arrivals = SUM(department_hourly[arrivals])

Total departures = SUM(department_hourly[departures])

Visit count = COUNTROWS(visits)

Latest snapshot = MAX(department_hourly[snapshot_time])

Patients at latest snapshot =
VAR Snapshot = [Latest snapshot]
RETURN CALCULATE(MAX(department_hourly[active_patients]), department_hourly[snapshot_time] = Snapshot)

Waiting at latest snapshot =
VAR Snapshot = [Latest snapshot]
RETURN CALCULATE(MAX(department_hourly[patients_waiting]), department_hourly[snapshot_time] = Snapshot)

Bed occupancy at latest snapshot =
VAR Snapshot = [Latest snapshot]
VAR Occupied = CALCULATE(MAX(department_hourly[occupied_beds]), department_hourly[snapshot_time] = Snapshot)
VAR Staffed = CALCULATE(MAX(department_hourly[staffed_beds]), department_hourly[snapshot_time] = Snapshot)
RETURN DIVIDE(Occupied, Staffed)

Area bed occupancy at latest snapshot =
VAR Snapshot = [Latest snapshot]
VAR Occupied = CALCULATE(SUM(area_capacity_hourly[occupied]), area_capacity_hourly[snapshot_time] = Snapshot, area_capacity_hourly[is_bed_area] = 1)
VAR Staffed = CALCULATE(SUM(area_capacity_hourly[staffed_capacity]), area_capacity_hourly[snapshot_time] = Snapshot, area_capacity_hourly[is_bed_area] = 1)
RETURN DIVIDE(Occupied, Staffed)

Average completed wait to assessment = AVERAGE(visits[wait_to_assessment_minutes])
```

`Average completed wait to assessment` excludes still-waiting visits whose value is null. This differs from the React demo's average elapsed time among currently queued patients; keep the labels distinct. Do not average the hourly mean and call it a patient-weighted monthly average.

With the full period selected, the initial generated data should show 3,015 arrivals, 9 active patients and 4 waiting at the latest snapshot, and 6/44 = 13.64% staffed-bed occupancy. The final snapshot is **28 Sep 2026 00:00**, representing the close of the final reporting hour on 27 Sep. Use High Demand periods within the dataset for congestion charts; the final hour is intentionally not forced into a surge.

## Integration status

1. Complete: synthetic JSON tables imported into PostgreSQL using explicit schemas, foreign keys and timezone handling.
2. Complete: backend snapshot endpoint connected to React, with the synthetic-data label retained.
3. Switch Power BI's source to PostgreSQL tables or reporting views. Preserve the column names and definitions.
4. If embedding in React is required, choose the supported authentication/licensing path before implementation. No report has been published or publicly shared, and no report ID or embed credentials exist yet.

This package contains data and report-building instructions, **not a finished .pbix report**. The DAX is provided for creation in Power BI Desktop and has not been executed in that engine.

## Connect to the running local PostgreSQL database

The database, import and React API connection are now implemented. In Power BI Desktop, use **Get data → PostgreSQL database**:

- Server: `127.0.0.1:5433`
- Database: `acuitycompass`
- Connectivity mode: **Import**
- Database username: `acuity_report`
- Password: the `report` value in your local, ignored `.local/database-credentials.json`. Do not include this file in presentations or uploads.

This account has SELECT permissions only on reporting data. It cannot modify visits or operational actions. Prefer it to the application or administrator accounts.

Choose `reporting.department_hourly`, `reporting.area_capacity_hourly`, `public.areas`, `public.dates` and `public.visits`. Rename the queries to the short names used in the relationship and DAX sections above. The reporting views and React API share the same source snapshots.

PostgreSQL timestamps represent instants; display them in Asia/Kolkata consistently. In Power Query, if the connector returns DateTimeZone, switch zone to UTC+05:30 before removing the zone (`DateTimeZone.RemoveZone(DateTimeZone.SwitchZone([snapshot_time], 5, 30))`). Apply the same conversion to hour_start and visit timestamps as appropriate. If values arrive as Date/Time without a zone, confirm their interpretation against the reference snapshot below before changing them; do not blindly add 5.5 hours twice. The `report_date` column is already the correct local reporting date.

Reference: latest snapshot is **28 Sep 2026 00:00 IST**, equivalent to **27 Sep 2026 18:30 UTC**. UI rounds occupancy to **14%**; a Power BI measure formatted to two decimal places shows **13.64%**. Both use 6 occupied / 44 staffed beds. UI rounds current-queue average wait from 74.25 to 74 minutes.

Remaining work: create and validate the one-page report in Power BI Desktop, then decide whether embedding is needed. No `.pbix` has been created yet.


## Authored report project

The report definitions and semantic model now exist in [../powerbi/AcuityCompass.pbip](../powerbi/AcuityCompass.pbip). Use [../powerbi/README.md](../powerbi/README.md) for the current opening workflow. The earlier manual construction instructions remain a reference. Source SQL in this project already converts timestamps to Asia/Kolkata: do not apply the manual timezone conversion a second time. Native Desktop validation remains pending.
