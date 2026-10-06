# Forecasting and operational planning

Implemented 6 October 2026. This is a connected local synthetic-data prototype, not a clinically validated hospital deployment.

## Quick walkthrough

1. Run **Start AcuityCompass.cmd**, then open http://127.0.0.1:5173/.
2. Keep **Combined patient records · PostgreSQL** selected. The page includes historical patients and website entries together.
3. **Add patient** opens only registration. **Update patient** opens searchable records; choose the row's Update patient, select a coordinator action, and save. Departed records remain available as read-only history.
4. Scroll to **Plan the next hour**. Demand forecast shows hourly expected arrivals, uncertainty and held-out accuracy.
5. Open **Resources & assumptions**. Enter resources manually, or click **Fill fictional demo assumptions**. The latter fills the form visibly; it does not claim these are actual staffing records. Review and save.
6. Select **Compare actions**, then its Compare actions button. Review usable capacity, all feasible alternatives, donor impact, checks and simulation assumptions.
7. Acknowledge the review checkbox to record a coordinator choice. This starts tracking a scenario; it does not move patients or staff. Update actual patient movements with the header button.
8. In **Action history**, enter a note and **Capture outcome**. The real elapsed duration is recorded, including observations captured before an hour has elapsed. Cancelled actions retain their history.
9. Open the existing Power BI project and Refresh to load the new planner outcome table and visuals. Public embedding still depends on the existing tenant permissions.

## Modules and functions

### `backend/src/forecast.ts`

- `features(time)` converts timestamps to IST, creates two hourly sine/cosine harmonics and six weekday indicators with an intercept.
- `fit(rows)` learns ridge regression coefficients using a pivoted Gaussian solver. Regularisation is fixed at 2, with a small intercept stabiliser. Predictions are clipped at zero.
- `seasonal(rows)` supplies the transparent baseline: average arrivals for each hour of the day.
- `trainForecast(rows, anchor)` validates nonnegative integer counts and consecutive hourly coverage. Fewer than 336 hours, duplicates or missing hours produce no forecast. The first 60% trains candidates; the next 20% selects the lowest-MAE candidate and calibrates an absolute-residual range; the last 20% reports held-out MAE and interval coverage. Final forecast coefficients use all records after evaluation. It returns 24 next-complete-IST-hour predictions, source dates and a stale flag.
- The learned model forecasts arrivals only. It does not predict diagnosis, patient deterioration, individual departure or clinical discharge eligibility.
- The nominal 80% empirical interval is calibrated on validation errors and evaluated on held-out hours. It has no guaranteed coverage under distribution shift; refitting can also change coverage. Selection and calibration share a block, so no formal conformal guarantee is claimed.

### `backend/src/planning.ts`

- `waiting(stage)` defines the modelled pre-treatment queue: Registration, Triage and Waiting. This intentionally differs from the dashboard's broader “awaiting next stage” count, which can also include boarding. The comparison labels its pre-treatment scope.
- `fingerprint(data)` hashes current visit IDs/latest-event IDs to detect patient changes before starting a comparison.
- `validateSettings(value,data)` validates area membership, unique resources, numerical limits, distinct donor/target, timestamps and readiness values on the server.
- `defaults(data)` copies configured area bed limits and sets staff/reserves to zero. Service durations and spaces-per-staff are explicit unverified placeholders, not inferred facts.
- `compare(data,settings,forecast)` calculates usable spaces as the minimum of ready spaces and staff-supported spaces. It checks reserve, redeployment and approved-transfer feasibility. An event simulation runs 200 reproducible replications per feasible option with Poisson arrivals and exponential service durations. Random streams are separated by area so donor comparisons are not altered by random draws in the target area.
- Baseline preserves resources; reserve adds one available staff member and up to two ready spaces; redeployment removes one donor staff member without crossing the configured minimum or occupied-bed coverage; transfer releases modelled slots only for capped bed-occupying Awaiting Bed candidates.
- The simulator routes all new demand to one target, treats service completion as slot release and does not model diagnostic dependencies, acuity-specific service, ongoing demand in donor areas, breaks or detailed staff skills. These limitations appear in the UI.
- Sensitivity checks test demand bounds and unknown ward readiness. Stale resources, stale demand or resource inconsistencies withhold automatic recommendation. Feasible scenario options remain available for a coordinator to review and record.
- `getPlanner(pool)` returns stored settings/version, forecast, areas and the latest 20 runs.
- `writePlanner(pool,body)` handles settings, comparison and status writes. Settings use optimistic versions. Starting checks the fingerprint, settings and ten-minute expiry. Status changes take the same database advisory lock as patient writes, and read patient state inside the transaction. Each terminal outcome records observed counts, elapsed time and a note.

### Frontend

- `src/types/planner.ts`: shared resource, forecast, result and outcome contracts.
- `src/components/Planner.tsx`: fetch wrapper, loading/error handling, resource form, demand plot, model metrics, comparison cards, verification requests and outcome history. It reloads after main dashboard or patient refreshes. Unsaved resource fields preserve their original version to prevent silent overwrites.
- `src/planner.css`: planning layouts, responsive comparison cards, resource editor and model chart styles.
- `src/workspace.css`: refreshed single-page theme, header shortcuts and patient editor styling.
- `src/App.tsx`: separate Add/Update dialogs, planner mounting for the combined source, dashboard navigation.
- `src/components/InteractivePatients.tsx`: registration, searchable queue, focused update editor, persisted patient event history. Save retains the existing conflict/bed validation.

## API

`GET /api/planner` returns resources, version, forecast, areas, runs and asOf. Forecast may be null when training data is insufficient.

`POST /api/planner`, JSON only, same allowed local origins as existing writes:

- `{kind:"settings", version, settings}` validates and timestamps the confirmed assumptions.
- `{kind:"compare", version}` computes and persists a server-side comparison with its input snapshot and forecast.
- `{kind:"status", id, status:"started", selected, confirmed:true, note:""}` starts a feasible choice after stale-state checks.
- `{kind:"status", id, status:"completed"|"cancelled", note}` captures the observed state. Completion requires started status. Terminal records cannot be restarted.

Responses: 400 invalid inputs, 409 stale version/comparison or invalid transition, 422 insufficient forecast data, 503 database/service failure. No fallback numbers are shown as database output.

## Persistence and Power BI

Migrations 011–012 add `planner_settings`, `planner_runs` and the read-only `reporting.planner_outcomes` view. Runs preserve assumptions, computed alternatives, the exact forecast, selected action and observed results. Source patient tables are unchanged.

`scripts/connect-planner-powerbi.mjs` adds the outcome table and outcome summary visuals to the existing one-page PBIP report. It can be rerun without duplicating objects. Refresh imports stored decisions; no extra credentials are embedded. The source includes predicted/observed queue, elapsed time, model error and notes for further analysis. Existing historical report-building scripts predate these visuals; rerun the planner connector if rebuilding the report from scratch.

## Data meaning and limits

The training series is `department_hourly`: 720 fully observed synthetic hours from 29 August through 27 September 2026. September demand is projected onto the chosen current calendar clock, explicitly labelled historical. Sparse website entries do not establish observation coverage for intervening hours and are not silently treated as complete new training days. They do update the combined state used by the planner.

Existing records retain their original dates. The app does not rewrite arrivals to make historical waits appear short. This is a synthetic continuation, not a live hospital feed. A realistic operational rollout needs validated event feeds, complete hourly coverage, locally agreed resource rules, user/role authentication and deployment security, supervised shadow evaluation and clinical governance.

Observed changes are not causal evidence that a chosen action worked. Simulated queue bands describe the simplified scenario, not hospital safety. The UI can abstain when assumptions are unsupported. No staffing allocation or patient treatment is automated.

## Verification

- `npm run build`, `npm run check:backend`.
- `npm test`: forecasting chronology/coverage/continuity, invalid settings, resource limits, deterministic comparisons and donor protection alongside existing metric tests.
- `npm run test:backend`: disposable-database API tests covering persistence, origin protection, stale versions, infeasible selections, terminal-state conflicts and reporting visibility, plus the existing patient lifecycle.
- Power BI: all 23 report definition files pass Microsoft JSON schemas and model-reference checks. The unavailable visualContainer 2.13.0 declaration was replaced with the published compatible 2.9.0 schema; Desktop cache files are excluded. Open the project and Refresh in Desktop for final rendering verification.

## Verified results on 6 October 2026
Production build and both TypeScript checks pass. All 15 unit tests and both disposable-database integration tests pass. The synthetic arrival model selected ridge regression: held-out MAE 1.34 arrivals/hour versus 1.42 for the seasonal baseline; nominal 80% range achieved 75.69% held-out coverage. These figures describe the fictional test series only. Browser checks covered the header update shortcut, patient search, resource saving, comparison, choice recording and outcome persistence. One clearly labelled early UI-test observation remains in action history; no patient records were changed by those checks.

