# AcuityCompass Power BI report

Open **AcuityCompass.pbip** in Power BI Desktop. Keep the `.Report` and `.SemanticModel` folders beside it; together they are the editable report project.

## First opening

1. Install and open [Power BI Desktop](https://www.microsoft.com/power-platform/products/power-bi/desktop). If your version requires preview settings, enable **Power BI Project (.pbip) save option** and **Store reports using enhanced metadata format (PBIR)** under File → Options and settings → Options → Preview features, then restart Desktop.
2. Start the database from the project root with `./scripts/start-local.ps1`.
3. Open `powerbi/AcuityCompass.pbip` and choose **Refresh**. At the PostgreSQL credentials prompt use **Database** authentication, username `acuity_report`, and the `report` password from the local ignored `.local/database-credentials.json`. Server is `127.0.0.1:5433`, database `acuitycompass`. Credentials are deliberately absent from the report files.
4. Check the values below, then save. You may use **Save As → .pbix** for a single-file presentation copy after refresh. No paid subscription is needed to author this local Desktop report; online sharing is a separate step.

On a fresh checkout, the visuals need their first successful refresh. The report has now been opened and refreshed in Desktop on this laptop, and published to Power BI Service. The expected full-period cards were verified in the Service. See [publication and UI connection status](../docs/POWER-BI-UI.md). This project contains the editable Power BI report definitions and semantic model.

## One page

- Date range filter covering the reporting period.
- Four cards: arrivals in the period, active patients at the latest selected snapshot, waiting patients at that snapshot, and staffed-bed occupancy.
- Daily arrivals/departures line chart.
- Latest selected snapshot occupancy by bed area.
- Arrival-cohort urgency chart, not the current active-patient urgency mix.
- Snapshot/date provenance banner.

The date filter controls the full page. Chart selections intentionally do not cross-filter the other visuals: a triage or area selection must not imply that department-wide cards use the same subset when the fact tables have different grains. There are no other report pages or hidden drill-through pages.

## Expected full-period results after refresh

| Measure | Expected |
|---|---:|
| Arrivals | 3,015 |
| Departures | 3,006 |
| Active patients | 9 |
| Patients waiting | 4 |
| Staffed-bed occupancy | 13.64% (6 / 44) |
| Latest snapshot | 28 Sep 2026, 00:00 IST |

The React page rounds occupancy to 14%; both products use the same underlying numbers. Source queries explicitly convert timestamps to Asia/Kolkata in PostgreSQL, so no additional timezone adjustment should be added in Power Query. The final midnight snapshot belongs to the reporting date of 27 September. Selecting another date range changes totals and the latest selected snapshot.

## Files and maintenance

- `AcuityCompass.pbip`: project entry point.
- `AcuityCompass.Report/definition/`: one page and 12 visual definitions.
- `AcuityCompass.SemanticModel/model.bim`: five import tables, four relationships and 11 DAX measures.
- `validation-results.json`: completed file/source-data checks and outstanding Desktop checks.

From the repository root:

```powershell
node scripts/validate-powerbi.mjs
node scripts/check-powerbi-data.mjs
```

The first check requires internet access to Microsoft's JSON schemas; the second requires local PostgreSQL. Neither executes the Power BI engine.

`node scripts/build-powerbi.mjs` regenerates the authored files. **It overwrites those files**, so do not run it after editing the report in Desktop unless you deliberately want to recreate the original layout. Back up your Desktop edits first.

Microsoft format references: [PBIP projects](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview), [PBIR report definitions](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report), [semantic model folder](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset).
# Combined ED dashboard (updated 1 October 2026)

Open `AcuityCompass.pbip` in Power BI Desktop and select **Combined ED dashboard**. **Home > Refresh** imports saved website registrations and movement updates from `reporting.interactive_patients` in the same PostgreSQL database. No public embedding permission is required for Desktop refresh.

Demo sequence: save a patient through the website's + Add patient panel, switch to Desktop, select Home > Refresh, and watch Entered visits / Current active / Current waiting change. Bed assignment updates Current occupancy; Discharged or Transferred updates Completed departures and releases occupancy on refresh. The record table includes departed visits. The refresh timestamp confirms when the database was read.

This is Import mode, not automatic streaming. The separate ED overview page still shows the September historical dataset. The published online report has not been republished with this new page; use the local Desktop project for this demonstration.

Migration 005 creates the read-only reporting view. `scripts/connect-interactive-powerbi.mjs` adds the table and page without rebuilding the historical report and saves a recovery copy under `.local`. Do not run the original full report builder casually: it overwrites report definitions.


## Unified Power BI report (current)
Open AcuityCompass.pbip and select Combined ED dashboard. There is now one report page, combining the original September dataset and website entries. Cards show all recorded visits, currently active/waiting patients, current bed occupancy, and all departures. Daily trends include all dates (zero-activity dates are included); area occupancy and urgency reflect the current saved state. Historical tables are retained as source history but are no longer displayed as a competing dashboard. There is no date slicer: card totals always describe the current combined state. Click Home > Refresh after website changes, then save.

scripts/build-combined-powerbi.mjs builds the report, backs up old definitions under .local, and uses migration 010's reporting.operational_daily and reporting.operational_areas. Close Desktop before rebuilding. Older build-powerbi.mjs and connect-interactive-powerbi.mjs are legacy scaffolds and recreate the superseded layouts.

## Planner update — 6 October 2026
The same report page now includes recorded choices, completed observations and comparisons by status. The model imports reporting.planner_outcomes. Run database migrations, reopen the PBIP from disk and Refresh. New definitions have not yet been visually verified in Desktop. See ../docs/PLANNING-AND-FORECASTING.md for data meaning and limitations.

