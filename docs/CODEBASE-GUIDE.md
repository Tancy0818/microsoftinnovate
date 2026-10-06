# AcuityCompass — complete codebase and teammate guide
> **6 October 2026 implementation update:** Forecasting, the four operational planning capabilities, a redesigned workspace, and separate Add/Update shortcuts are implemented. Read [PLANNING-AND-FORECASTING.md](PLANNING-AND-FORECASTING.md) for the new modules, API, model validation, database tables, Power BI changes and limitations. Its current-status descriptions supersede the older proposals below.


Power BI update: section 23 connects saved interactive entries to a new Desktop report page. Earlier historical-only statements refer to the previous report version; ED overview remains historical, while Website patient entries reads interactive records after refresh.

Main-page integration update: patient entry now opens from **+ Add patient** in the existing dashboard dialog. The standalone interactive-screen description in section 21 is superseded by section 22 below.

Latest addition: **section 21** describes persistent patient registration and movement in the separate Interactive synthetic demo. This supersedes older statements below that patient entry is not implemented. Historical reporting and interactive records remain isolated.

Updated 1 October 2026: section 20 explains the new transfer follow-up modules and event-based stage timing. See [TEACHER-DEMO.md](TEACHER-DEMO.md) for the presentation walkthrough.

Reviewed against the project source on **30 September 2026**. This document explains the implementation that exists, including its limitations. Proposed features are labelled separately. You can share this file by itself; the relative links work when it stays in the project's `docs/` folder.

## Contents

1. [What the application does](#1-what-the-application-does)
2. [Architecture and reading order](#2-architecture-and-reading-order)
3. [Project files and configuration](#3-project-files-and-configuration)
4. [Shared data types](#4-shared-data-types)
5. [Main React page](#5-main-react-page)
6. [UI components](#6-ui-components)
7. [Frontend services and demo generation](#7-frontend-services-and-demo-generation)
8. [Metrics, formatting and alert rules](#8-metrics-formatting-and-alert-rules)
9. [Backend functions and API](#9-backend-functions-and-api)
10. [Database schema and reporting views](#10-database-schema-and-reporting-views)
11. [Synthetic dataset generator](#11-synthetic-dataset-generator)
12. [Power BI model and report builder](#12-power-bi-model-and-report-builder)
13. [Setup, maintenance and validation scripts](#13-setup-maintenance-and-validation-scripts)
14. [Tests and verification](#14-tests-and-verification)
15. [Worked examples of data flow](#15-worked-examples-of-data-flow)
16. [Running and sharing the project](#16-running-and-sharing-the-project)
17. [Where to change things](#17-where-to-change-things)
18. [Limitations and future work](#18-limitations-and-future-work)
19. [Glossary and presentation questions](#19-glossary-and-presentation-questions)

## 1. What the application does

AcuityCompass is a student prototype for understanding emergency-department activity. Its one React page shows the patient queue, waiting, capacity, arrivals/departures and operational alerts. Clicking a card opens a detail panel on the same page. There is no multi-page router.

The main data source is a local PostgreSQL database containing entirely fictional visits. A Node.js API reads this database and supplies JSON to React. Three additional built-in scenarios demonstrate normal, high-demand and stale-data conditions without accessing the database.

Power BI reads the reporting data separately and provides historical analysis. It has been refreshed in Desktop and published to the owner's **My workspace**. Embedding code supports both private and public report URLs, but **no embed URL is configured**: public code creation is currently blocked by the organisation's administrator setting. The user selected free features only and approved public access to synthetic data; no trial or paid subscription was activated, and no public embed code was created.

### Working versus proposed

| Working in this version | Not implemented yet |
|---|---|
| One-page dashboard and detail panels | Patient registration/editing/discharge forms |
| PostgreSQL reads through an API | Automatic hospital-system ingestion |
| Patient search, filters, sorting and timelines | Staff login, roles and production authentication |
| Persisted alert acknowledgements and task statuses | Automatic recalculation after arbitrary patient edits |
| Synthetic dataset generation and controlled import | Dataset upload through the UI |
| Power BI Desktop and published personal report | Embedded report verification and scheduled cloud refresh |
| Deterministic operational alert rules | AI prediction, clinical recommendations or forecasting |

The final historical snapshot is **28 September 2026, 00:00 IST**. It has 9 active patients, 4 waiting patients and 6 occupied staffed beds out of 44. The UI rounds the occupancy to 14%; Power BI shows 13.64%. Refreshing does not advance this historical clock.

## 2. Architecture and reading order

```text
scripts/generate-dataset.mjs
    -> dataset/dataset.json + CSV tables + manifest
    -> backend importer
    -> PostgreSQL tables and reporting views
          |
          +-> Node HTTP API (127.0.0.1:3001)
          |     -> Vite /api proxy (127.0.0.1:5173)
          |     -> frontend API client -> App state -> React components
          |
          +-> Power Query import -> Power BI model -> DAX -> report visuals

Built-in scenarios -> mock provider -> App state -> same React components

Configured Power BI URL -> iframe in React (connection pending)
```

The browser does not connect directly to PostgreSQL. It sends HTTP requests to the API through Vite. PostgreSQL credentials remain on the server. Power BI has its own read-only database account and imported data copy; it does not request data from the React page.

Recommended reading order: `src/types/dashboard.ts`, `src/App.tsx`, `src/services/apiDashboardService.ts`, `backend/src/app.ts`, `backend/src/dashboard.ts`, the SQL migrations, then the metric rules and Power BI model. This follows one request from screen to database and back.

The project uses React and React DOM for rendering, TypeScript for static checking, Vite for frontend development/building, Recharts for graphs, Lucide for icons, `pg` for PostgreSQL, and Node's built-in HTTP and test modules. There is no Express server or ORM. AJV validates generated Power BI JSON definitions; Prettier is available for formatting.

## 3. Project files and configuration

| File/folder | Responsibility |
|---|---|
| `index.html` | HTML document containing the React root and frontend entry script. |
| `src/main.tsx` | Imports global styles, creates the React root and renders `App` inside `React.StrictMode`. Strict Mode helps expose effect problems during development. |
| `src/App.tsx` | Current page composition, source selection, loading, API actions and drawer state. |
| `src/components/` | Charts, queue, alerts, shared UI elements, embed and some unused earlier components. |
| `src/services/` | HTTP client and built-in demo provider. |
| `src/data/scenarios.ts` | Small demo records generated in memory. |
| `src/types/dashboard.ts` | Shared TypeScript contracts imported by frontend and backend. |
| `src/utils/` | Shared metrics, rules, formatting and embed URL validation. |
| `backend/src/` | Server, endpoints, SQL reads/writes, migration runner and importer. |
| `database/migrations/` | Ordered SQL schema changes. |
| `dataset/` | Reproducible generated data, manifest and detailed data dictionary. |
| `powerbi/` | Editable PBIP report, report definition folder and semantic model folder. Keep them together. |
| `scripts/` | Windows lifecycle scripts, data/model generators and validation tools. |
| `tests/`, `backend/tests/` | Unit-style rule tests and real PostgreSQL integration tests. |
| `docs/` | This guide and shorter setup/API/Power BI documents. |
| `public/compass.svg` | Static branding asset. |
| `public/fonts/` | Local font files and DM Sans/Manrope licence notices. |
| `outputs/` | Presentation artifacts, workbook exports and screenshots; not application source. |
| `.local/` | Machine-specific PostgreSQL runtime, data, credentials, PID files and logs. Do not share. |
| `dist/` | Generated frontend build output, not source. |
| `node_modules/` | Installed dependencies, reproducible from the lockfile. |

### Configuration files

- `package.json`: dependency versions, Node requirement and command aliases. `type: module` means JavaScript uses ES module imports. The project requires Node **22.18 or later**; Node 24 is the documented setup choice.
- `package-lock.json`: exact dependency resolution. Share it and use `npm ci` for consistent installations.
- `vite.config.ts`: enables React support and forwards development requests beginning `/api` to `http://127.0.0.1:3001`.
- `tsconfig.json`: strict frontend TypeScript checking, DOM types, JSX transform and no emitted TypeScript output. Vite builds the browser assets.
- `backend/tsconfig.json`: separate strict Node-oriented checks for backend source and integration tests.
- `src/vite-env.d.ts`: supplies Vite environment typings.
- `.env.example`: safe template. `.env` contains `DATABASE_URL`, optional `API_PORT` and optional `VITE_POWER_BI_EMBED_URL`. **Any `VITE_` variable is browser-visible**; only put a report URL there, never a password or token.
- `.gitignore`: excludes local credentials/runtime, generated builds, dependencies, logs and Power BI caches. Ignoring files in Git does not exclude them from an ordinary ZIP automatically.

### Stylesheets

`src/styles.css` provides local `@font-face` declarations, shared colours/type styling, tables, panels, badges, queue controls, charts and retained earlier layouts. `src/dashboard.css`, imported by `App`, supplies the current dashboard shell, KPI tiles, grid, compact chart overrides, detail drawer, action area and Power BI wrapper.

The current dashboard has breakpoints around 1500, 1150 and 700 pixels; the shared stylesheet has additional component/layout breakpoints. Both include reduced-motion handling. Keep both stylesheets: unused older components do not mean the shared styles can all be removed. CSS selectors such as `.dash-*`, `.patient-table`, `.attention-*` and `.bi-*` identify the relevant UI area; CSS has no data-fetching responsibilities.

## 4. Shared data types

Types describe the shape expected by code; they are not full runtime validation of incoming JSON.

| Type | Fields and meaning |
|---|---|
| `TriageLevel` | Red, Orange, Yellow, Green or Blue. |
| `PatientStage` | Registration, Triage, Waiting, Assessment, Treatment, Awaiting Bed or Discharge. |
| `Scenario` | `normal`, `high` or `stale`; database and empty source choices are added locally in `App`. |
| `Tone` | `normal`, `warning`, `critical`, `info`; visual severity vocabulary. |
| `Patient` | `id`, `arrivalTime`, urgency, `stage`, `area`, `waitingMinutes`, optional `assignedBed`, `lastUpdated`, status and optional recorded `timeline`. No real names or clinical records. |
| `AreaCapacity` | Area name, staffed capacity, occupied spaces, waiting count and nullable staff headcount. Database staff headcounts are unknown (`null`). |
| `OperationalAlert` | ID, severity, title, explanation, trigger, affected entity, suggested action, creation time and acknowledgement state. |
| `OperationalTask` | ID, description, related alert ID, assigned role, priority and Open/In Progress/Completed state. |
| `HourlyFlow` | Hour label plus arrivals and departures. |
| `DashboardData` | Scenario tag, patients, areas, history, alerts, tasks and snapshot `updatedAt`. |
| `ApiDashboard` | Client response envelope: ready/empty `state`, nullable `data`, `synthetic` and PostgreSQL `source`. The backend additionally supplies snapshot and summary fields on ready responses. |
| `DashboardDataProvider` | Demo-provider interface requiring asynchronous `getDashboard(scenario)`. The database client is separate, not an implementation of this interface. |

Times in API objects are ISO timestamps with timezone information. The database adapter translates SQL snake_case names into the camelCase fields above.

## 5. Main React page

Source: [src/App.tsx](../src/App.tsx).

### `App()` and its state

`App` is the root functional component. A state setter causes React to render again with the new values.

| State/ref | Why it exists |
|---|---|
| `source` | Starts at `database`; selects database, empty preview or one of three demos. |
| `data` | Current `DashboardData`, or `null` while empty/loading/failed. |
| `loading`, `error` | Read-request status and visible failure message. |
| `detail`, `alertId` | Which drawer to show and whether to isolate a particular alert. |
| `revision` | Incremented by Refresh/Reset/Retry to trigger a fresh load. |
| `now` | Updated every ten seconds for demo freshness display. **This timer does not poll the API.** |
| `saving`, `actionError` | Write-request status and failure message; prevent overlapping user actions. |
| `preferReport` | Whether to show configured Power BI analytics or the local chart preview. |
| `dialog` | Reference to the native HTML `<dialog>` element. |

`configuredReport` comes from the Vite environment, `reportUrl` is validated, and `showReport` requires database source, a valid URL and `preferReport`. Demo modes always use local charts. This conditional is independent of API loading, because Power BI loads its own imported model.

### The three effects

1. **Clock effect:** starts a ten-second interval and clears it on unmount.
2. **Data-loading effect:** runs when source or revision changes. Clears prior data/errors and closes the detail selection. Empty mode returns without making a request. Database mode calls `getDatabaseDashboard`; demo mode calls the mock provider. Success stores data, failure stores an error, and completion clears loading. Its `cancelled` flag prevents an old request from replacing a newer source selection; it does not itself abort that request.
3. **Drawer effect:** opens the dialog with `showModal()`, temporarily locks body scrolling and remembers focus. Cleanup restores scrolling and returns focus to the previous element. Close controls/native cancel clear the detail state.

### Event-handler functions

| Function | Input, behaviour and result |
|---|---|
| `open(d, id = null)` | Selects a detail type and optional alert ID. It opens a panel through state, without navigating to another URL. |
| `persistAction(alertId, kind, status?)` | Returns early without data or while saving. Sends the snapshot and action to the API; replaces data only after a successful response. On failure, displays `actionError`; `finally` clears saving. |
| `acknowledge(id)` | Database mode delegates to `persistAction`. Demo mode immutably changes the matching alert to Acknowledged in memory. |
| `updateTask(id, status)` | Looks up the task's related alert for database writes; demo mode immutably updates the task array. |
| Inline source handler | Changes source; the loading effect performs the work. |
| Inline Refresh/Retry handler | Increments revision; it does not directly edit records. |
| Inline preview/report handlers | Toggle `preferReport`, leaving the operational dataset unchanged. |
| Inline close/cancel handlers | Clear detail state and remove the modal. |

`cards` is a configuration array for four KPI buttons. `metrics` is derived from `data`, not separately fetched. `empty` is reusable JSX that distinguishes loading, unavailable data and no records. Missing data displays an em dash rather than fake zeros.

### Drawer content and page composition

| Detail key | Rendered content |
|---|---|
| `patients` | Full expanded queue. |
| `waiting` | Expanded queue restricted by `isWaiting`. |
| `wait` | Average elapsed wait and count grouped by triage, plus waiting queue. Empty groups display an em dash. |
| `capacity` | Expanded capacity table, including unknown staff headcounts. |
| `flow` | Stage counts/median wait plus patient queue. |
| `arrivals` | Chart plus hourly numeric table. |
| `triage` | Active-patient urgency chart plus queue. |
| `alerts` | All alerts/tasks or one selected alert/task, inside a fieldset disabled during saves. |

Without an embed, the overview contains KPIs, arrivals, flow, compact capacity, urgency and attention tiles. With an embed, Power BI replaces the main KPI/chart region; operational shortcut buttons, queue access and alerts remain below. Power BI chart clicks do not open React drawers. `Tile({title, caption, onOpen, children, className})` renders the shared clickable tile heading and content wrapper.

## 6. UI components

### `src/components/PatientQueue.tsx`

`PatientQueue({patients, expanded = false})` maintains search text, triage/stage/area filters, descending sort, page and selected patient. `useMemo` filters by case-insensitive ID and exact optional filter values, then sorts the new filtered array by `waitingMinutes`; the original array is not sorted in place.

Expanded queues show 12 rows per page; other instances show 6. `maxPage` and `currentPage` clamp pagination if filtering reduces the results. Input/select callbacks update their state and reset the page; sort reverses the order; pagination changes the page. Selecting a row stores a patient object for the detail record.

`reset()` clears all four search/filter fields and returns to page zero. A no-match state provides a clear-filter button. Search and filter operations happen entirely in the browser against the already loaded queue, not through SQL per keystroke.

`PatientDetails({patient: p, onClose})` renders the selected record inline inside the queue area. Its effect focuses and scrolls the record into view when patient ID changes. `elapsed` is computed from snapshot time minus arrival. It uses the supplied `timeline` for database records; only demos without a timeline receive illustrative arrival/registration/current-stage events. The close callback belongs to the parent queue. This is a read-only record, not an edit form.

### `src/components/Charts.tsx`

| Component/function | Behaviour |
|---|---|
| `PatientFlowChart({patients})` | Uses `flowByStage`, highlights the longest recorded median time in the current stage, and scales bars by count. Unknown timing shows an em dash. Duration does not establish the cause of a delay. |
| `TriageChart({patients})` | Counts each urgency level, draws a Recharts doughnut, shows total and rounded percentages, and formats tooltips using shared colours/labels. It describes active patients supplied to it. |
| `ArrivalDepartureChart({data})` | Draws the twelve hourly arrival/departure series with axes, tooltips and legend. Its insight uses the shared three-hour imbalance condition. “Balanced” here means that particular rule did not trigger, not exact equality of all values. |
| `ClockIcon()` | Returns a small `ArrowDownUp` icon used beside the time-window label; no time calculation. |
| `CapacityPanel({data, expanded = false})` | Displays area occupancy/capacity, waiting and utilisation. Expanded mode adds staff headcount. Status is Full at 100%, Near capacity at 85%, Busy at 70%, otherwise Available. These display thresholds differ from department pressure thresholds. |

Recharts `ResponsiveContainer` sizes charts to their parent. Other bars are plain styled HTML. `.map` callbacks build visual rows, legend entries and cells; they do not modify the dataset. Compact charts in dashboard tiles use CSS overrides to reduce nested panel decoration.

### `src/components/AlertsPanel.tsx`

`AttentionPanel({alerts, tasks, onAcknowledge, onStatus})` joins each alert with its task by `relatedAlertId`. Severity chooses icon and colour. Each card explains the trigger, affected entity and suggested action. “Mark as seen” invokes the supplied acknowledgement callback and is disabled once not Open. The task select invokes the supplied status callback. This component never accesses the database itself. Expanding “Why was this flagged?” uses native HTML `<details>`.

Completing a task does **not** alter patient flow, resolve the underlying condition or automatically set an alert to Resolved. `Resolved` exists in the type but no resolution workflow is implemented.

### `src/components/Common.tsx`

- `Badge({children, tone = 'info'})`: coloured status text and dot.
- `Panel({title, subtitle, extra, children, className = '', id})`: section with heading, optional subtitle and optional extra header content.
- `Insight({children, warning = false})`: information/insight strip with optional warning styling.

These are presentation wrappers. They receive content and do not fetch or persist anything.

### `src/components/PowerBIReport.tsx`

`PowerBIReport({url, onPreview})` embeds a validated URL. `isPublic` identifies `/view` links so the text does not incorrectly demand sign-in for a public report. `attempt` increments on Reload and forms part of the iframe key, forcing recreation. The effect resets loading state and starts a fifteen-second help timer; cleanup and iframe `onLoad` clear the timer. `opened` hides the opening message and `slow` shows help if loading is prolonged.

Open report uses a new tab with `noopener noreferrer`; Use local preview invokes `onPreview`. The iframe allows full-screen. **An iframe load event does not prove Power BI authenticated or rendered correctly**, because the cross-origin frame cannot be inspected by this component. There is no Power BI SDK, access-token generator or automatic fallback on authentication failure.

Reloading the iframe does not refresh the Power BI imported model. Its date filters do not change React's latest-snapshot queue. There is no public URL yet, so this path is configured in code but not demonstrated end-to-end with the real report.

### Retained earlier components — not used by current `App`

| File/function | What it does if rendered |
|---|---|
| `Header.tsx` → `Header(...)` | Earlier descriptive header, synthetic-data notice, scenario selector and reset button; receives callbacks and freshness text from a parent. |
| `Header.tsx` → `Footer()` | Earlier synthetic-data disclaimer/footer. |
| `MetricCards.tsx` → `MetricCards({data, stale})` | Earlier non-clickable KPI presentation calculated from shared metrics; adds potentially-outdated labels. |
| `StatusBanner.tsx` → `StatusBanner({data, stale})` | Earlier status explanation based on stale flag and High/Critical pressure. |

Editing these files will not change the current page unless they are imported and rendered. The current header, footer, status strip and clickable KPI buttons are defined in `App.tsx`.

## 7. Frontend services and demo generation

### `src/services/apiDashboardService.ts`

`request(path, options?)` calls `fetch` with a ten-second `AbortSignal.timeout`. A network/timeout failure becomes a readable backend-unreachable message. Invalid JSON produces a different message. Non-success HTTP responses throw the API's error message; success must have ready/empty state. The client does not deeply validate every nested object.

`getDatabaseDashboard()` is a GET wrapper for `/api/dashboard`. `saveDatabaseAction(body)` sends JSON to `/api/actions` with PATCH and returns the refreshed envelope. Neither receives database passwords. Relative URLs rely on the Vite proxy during development.

### Provider files

`dashboardDataProvider.ts` defines the demo provider contract. `mockDashboardService.ts` exports `dashboardProvider`, whose `getDashboard(scenario)` waits approximately 450 milliseconds to demonstrate loading, then returns `createScenario(scenario)`. A `?mockError=1` query parameter deliberately throws an error for demos. It does not affect the real PostgreSQL API.

### `src/data/scenarios.ts` → `createScenario(scenario, now = Date.now())`

This creates a small deterministic example relative to the supplied time. Stale mode subtracts 27 minutes from that time; resetting stale mode therefore keeps demonstrating a stale source.

`areaNames`, `capacities`, `distributions` and `triages` are fixture constants. The nested `make(area, index, overflowQueue = false)` chooses a stage, urgency, wait duration, ID, arrival time, optional bed and illustrative status, then pushes a patient. Normal mode keeps priority waits short; high mode increases queues and occupied beds; high/stale examples add some unbedded observation overflow patients.

The function then constructs area totals, illustrative staff counts and twelve hourly flow entries, calls `generateAlerts`, and creates linked task descriptions, roles and priorities. It returns a `DashboardData` object. Identical scenario/time inputs yield identical records.

Demo records (`ED-...`) are independent of imported dataset records (`SYN-...`). Demo action edits live only in React state and disappear on reset. Database timelines, staff availability and status rules are not identical to these illustrative fixtures. Demo hourly labels currently use the machine locale's timezone, while database history explicitly uses Asia/Kolkata.

## 8. Metrics, formatting and alert rules

### `src/utils/calculateMetrics.ts`

| Export | Exact purpose |
|---|---|
| `stages` | Ordered seven-stage list used by filters and flow displays. |
| `isWaiting(p)` | True for Registration, Triage, Waiting and Awaiting Bed. |
| `median(values)` | Copies and numerically sorts values. Odd length returns the middle value; even length averages the middle pair; empty array returns 0. |
| `flowByStage(patients)` | Returns stage, count and rounded median `stageMinutes`. Empty groups or groups with missing stage timing return null. Arrival elapsed time is never substituted for stage duration. |
| `calculateMetrics(data)` | Derives the KPI/pressure/imbalance object described below. |
| `freshness(updatedAt, now = Date.now())` | Floors elapsed minutes, clamps future times to 0, labels less than 5 Live, 5–20 Delayed and greater than 20 Stale. |

`calculateMetrics` counts all supplied patients as active and filters waiting patients using `isWaiting`. It includes only Resuscitation, Examination, Observation and Boarding in staffed-bed totals. Occupancy is rounded once to a whole percent. Average wait is the rounded mean for the current waiting group; an empty waiting group gives 0. `netChange` is last-hour arrivals minus departures. `imbalance` is true when each of the last three supplied hourly records has more arrivals than departures.

Pressure is evaluated from highest to lowest:

| Pressure | Condition |
|---|---|
| Critical | Rounded occupancy ≥95% **or** waiting count ≥35 |
| High | Occupancy ≥85% **or** waiting count ≥25 |
| Moderate | Occupancy ≥75% **or** waiting count ≥18 |
| Low | None of those conditions |

The function assumes a positive bed capacity and nonempty history. It is not designed to receive arbitrary incomplete data. `App` avoids calling it when data is `null`. The three-hour check assumes normal input contains enough history; a shorter history is not explicitly rejected.

### `src/utils/alertRules.ts`

`thresholds` exposes occupancyWarning=85, occupancyCritical=95, highAcuityWait=15 and staleMinutes=20. `generateAlerts(data, {historical = false})` derives metrics, creates alerts with its internal `add(...)` helper, and sorts Critical before Warning before Information.

| ID | Trigger and result |
|---|---|
| `beds` | Rounded bed occupancy ≥85%; Critical at ≥95%, otherwise Warning. |
| `acuity` | Any Red/Orange patient in a waiting stage with elapsed wait **greater than** 15 minutes; Critical. |
| `observation` | Observation occupied/capacity ratio ≥0.85; Warning. |
| `arrivals` | Shared recent three-hour imbalance; Warning. |
| `stale` | Freshness is Stale and historical mode is false; Warning. |
| `stable` | No other alert was created; an Information item, not an operational problem. |

`add` supplies stable rule ID, text, affected entity, suggested action, snapshot time and Open status. The backend overlays saved acknowledgements afterward. These are hard-coded demonstration rules, not AI or clinical standards. Observation lookup assumes that named area exists. The stale rule calls `freshness`; changing `thresholds.staleMinutes` alone will not change `freshness`'s hard-coded boundary.

### `src/utils/formatters.ts`

`time(value)` formats a date/string/number as 24-hour `HH:mm` in Asia/Kolkata. `triageLabels` maps urgency colours to descriptions. `triageColors` maps them to chart hex colours. These constants keep charts and tables consistent.

### `src/utils/powerBIReportUrl.ts`

`powerBIReportUrl(value)` returns a normalised URL or `null`. It accepts only HTTPS, the exact `app.powerbi.com` host, and `/reportEmbed` or `/view`; credentials, nondefault ports and fragments are rejected.

For `/view`, it requires a sufficiently long base64-like `r` code and constructs a clean URL containing only that code. Arbitrary additional parameters are discarded. This checks shape, not whether the code exists or whether publication is permitted.

For `/reportEmbed`, it requires a UUID-shaped report ID, rejects query keys matching token/secret/password, and sets `autoAuth=true` and `navContentPaneEnabled=false`. URL validation does not grant access or create a public report. The `.env` URL remains unset until the service actually issues an allowed link.

## 9. Backend functions and API

### `backend/src/server.ts`

This is the runtime entry point: create a connection pool, build the HTTP server with `createApi(pool)`, and listen on `127.0.0.1` using `API_PORT` or 3001. A server error sets a failed process exit code and closes the pool. SIGINT/SIGTERM handlers close the server and then the pool. Importing backend modules in tests does not automatically start this server because construction lives in the separate entry point.

### `backend/src/db.ts` → `createPool(connectionString = process.env.DATABASE_URL)`

Rejects a missing connection string and creates a `pg.Pool` with up to five connections, a three-second connection timeout and a fifteen-second statement timeout. Pooling reuses connections. Callers acquiring an individual client must release it in `finally`.

### `backend/src/app.ts`

- `send(res, status, body)`: serialises JSON, sets status, `Content-Type`, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, then ends the response.
- `json(req)`: reads body chunks; rejects accumulated bodies over 8192 bytes, malformed JSON, arrays, null and nonobjects as `INVALID_ACTION`.
- `createApi(pool)`: returns a Node HTTP server with an async route callback; query strings are removed when matching the route.

| Method/path | Behaviour |
|---|---|
| GET `/api/health` | Executes `SELECT 1`; returns `{status:'ok', database:'connected'}` on success. |
| GET `/api/dashboard` | Calls `getDashboard(pool)`; returns ready or empty response. |
| PATCH `/api/actions` | Checks Origin when supplied, requires JSON Content-Type, reads body and calls `saveAction`. |
| Other route/method | Returns 404. |

PATCH permits supplied origins only from `http://127.0.0.1:5173` and `http://localhost:5173`. Missing Origin is permitted; this is **not authentication**. Errors map to 400 invalid action, 409 changed snapshot, 403 disallowed origin, 415 non-JSON content, or 503 for database/unhandled operation failures. The generic 503 avoids leaking SQL/credentials but can also represent an unexpected application error. Logs print the error class, not a complete diagnostic stack.

Example acknowledgement body:

```json
{
  "snapshotTime": "2026-09-27T18:30:00.000Z",
  "alertId": "stable",
  "kind": "acknowledge"
}
```

For a task use `kind: "task"`, a currently generated non-information alert ID, and `status: "Open"`, `"In Progress"` or `"Completed"`. Inventing an alert ID will be rejected. The latest imported snapshot may have only the stable information item and therefore no actionable task.

### `backend/src/dashboard.ts`

**`readDashboard(client)`** operates on an already acquired client:

1. Select the latest department snapshot. If absent, return `state: empty`, null data and source/provenance flags.
2. Read `reporting.latest_patients`, ordered by descending elapsed minutes then ID. Map SQL fields to `Patient`, convert timestamps to ISO, and convert elapsed values to numbers.
3. Set status: Red/Orange gets Priority; other patients above 30 elapsed minutes get Delayed; otherwise Stable. This descriptive mapping differs from the demo fixture mapping.
4. Fetch all stage events before the snapshot for active visit IDs, join area names, and attach each patient's recorded timeline.
5. Fetch the matching area snapshot; set `staffOnDuty: null` because the dataset does not supply it.
6. Fetch twelve hourly history rows at/before the snapshot, format hour in Asia/Kolkata and reverse them into chronological order.
7. Generate alerts with `historical: true` so a historical sample is not treated as a failed live feed.
8. Read `operational_actions` for that snapshot. Create tasks for non-information alerts, with saved task status or Open. Overlay acknowledged flags onto alerts.
9. Return data, snapshot provenance and an additional database summary for reconciliation.

The returned `scenario: 'normal'` is a compatibility field, not a diagnosis of demand in the database. Pressure and alerts are computed from actual loaded records.

**`getDashboard(pool)`** acquires a client, starts a REPEATABLE READ READ ONLY transaction, calls `readDashboard`, commits and returns the result. Failure rolls back; `finally` releases the client. The transaction gives multiple SQL reads a consistent database view.

**`saveAction(pool, body)`** validates field types, parseable snapshot date, kind and task status. It opens a REPEATABLE READ write transaction and reads the current dashboard. A missing or different snapshot raises `STALE_SNAPSHOT`; an unknown alert or task against an information alert raises `INVALID_ACTION`. It parameterises the values in an INSERT ... ON CONFLICT update keyed by snapshot and alert. Acknowledging changes only `acknowledged`; task writes change only `task_status`. It rereads the dashboard, commits and returns the updated result; errors roll back and release resources. Records from other snapshots are not overwritten.

### `backend/src/migrate.ts` → `migrate(pool)`

Starts a transaction and takes advisory transaction lock `7234091`. It creates `schema_migrations` if necessary, finds `.sql` migration files, sorts their names and skips recorded names. Each new SQL file executes and its filename is recorded before commit. Failure rolls everything back. The advisory lock is shared with importing to serialise those operations. Add a new numbered migration for changes; editing an already recorded filename does not make it run again.

### `backend/src/import-dataset.ts` → `importDataset(pool, path = dataset JSON URL)`

Reads/parses JSON and hashes the entire file with SHA-256. In a transaction with the same advisory lock, it sets the session-local timezone to Asia/Kolkata. An already recorded hash returns “Already imported; no changes.” A different dataset is rejected when department snapshots already exist: this importer is **not a replacement/upsert system**.

It requires nonempty arrays for six whitelisted tables, converts empty strings to null, and inserts chunks of up to 1000 records using `jsonb_populate_recordset`. Table names come from a code-owned allowlist; values use parameterised JSON. SQL constraints provide further validation. It verifies latest queue count against the latest recorded census and checks duplicate active visits, writes provenance to `dataset_imports`, and commits. Any error rolls back the whole import.

The importer does not recompute all hourly aggregates from edited raw records or prove every historical invariant. The generator provides additional checks. Byte-level file changes change the hash, including formatting changes. To test a different generated dataset, use a separate database rather than deleting the existing one casually.

### `backend/src/cli.ts`

Creates a pool and dispatches the command-line argument `migrate` or `import`. Prints a result, sets an error exit code on failure and always closes the pool. Package scripts load `.env` before this file runs.

## 10. Database schema and reporting views

Source: [001_initial.sql](../database/migrations/001_initial.sql) and [002_reporting_access.sql](../database/migrations/002_reporting_access.sql). A table's **grain** means what one row represents.

| Table | Grain/key | Main fields and purpose |
|---|---|---|
| `areas` | One area; `area_id` | Unique name, positive staffed capacity and 0/1 bed-area flag. |
| `dates` | One reporting date; `report_date` | Day number and weekday name. |
| `visits` | One encounter; `visit_id` | Arrival/departure dates and times, urgency, arrival condition, first care area/assessment, wait/stay measurements, cutoff state and synthetic flag. |
| `flow_events` | One stage interval; `event_id` | Visit and area references, stage, optional bed ID, start/end and observed minutes. Many events belong to one visit. |
| `department_hourly` | One hour; `hour_start` | Unique ending snapshot, reporting date/hour, arrivals/departures, census, waiting mean/count, occupied/staffed beds and high-acuity waiting count. |
| `area_capacity_hourly` | One area/snapshot; composite key | Capacity, occupied, waiting, overflow and bed-area/synthetic flags. |
| `dataset_imports` | One imported file hash; `id` | Import time, source description, latest snapshot and synthetic provenance. |
| `operational_actions` | One snapshot/alert; composite key | Acknowledgement boolean, task status and modification timestamp. |
| `schema_migrations` | One applied SQL filename; `name` | Application timestamp. Created by migration runner. |

`visits.arrival_date` references dates; first care area references areas. `flow_events` references visits and areas. Hourly area records reference department snapshot, dates and areas. Operational actions reference a department snapshot. Departure date and cutoff-area text are not declared foreign keys in this version.

Checks enforce allowed urgency/stage values, nonnegative counts/durations, synthetic-only records, valid stage/departure ordering, positive capacity and occupied-bed bounds. Department snapshot must be exactly one hour after hour start. Flow indexes support lookup by visit/start and by stage intervals. No SQL constraint alone prevents all overlapping bed allocations; the generator verifies those.

Reporting views are stored queries, not separate imported copies:

- `reporting.department_hourly`: exposes department facts.
- `reporting.area_capacity_hourly`: joins area names onto capacity facts.
- `reporting.latest_patients`: finds the maximum department snapshot, selects events active immediately before that instant, joins visits/areas and computes elapsed minutes since arrival.

The interval predicate is `stage_start < snapshot AND (stage_end IS NULL OR stage_end >= snapshot)`. This deliberately represents the instant just before the boundary. Hourly arrivals/departures use `[hour_start, snapshot_time)`. A midnight snapshot belongs to the preceding hour's reporting date.

Migration 002 grants the existing `acuity_report` role schema usage and SELECT on six source tables and reporting views. It skips grants if the role does not exist. Setup creates that role first. `acuity_app` owns the development database; `acuity_report` reads reporting data; the local `postgres` account is used for setup and isolated test-database management.

### Dataset field meanings that are easy to confuse

`wait_to_assessment_minutes` means arrival to first assessment, blank when assessment is not yet observed. `wait_elapsed_minutes` in visits is capped at assessment/cutoff. The API's `Patient.waitingMinutes` comes from snapshot minus arrival instead. The department's average uses that elapsed-since-arrival measure only for patients currently in waiting stages. These are different quantities.

`ed_stay_minutes` is available for completed visits. `stage_end` is blank for a stage open at the cutoff. `observed_minutes` includes only observed time. `status_at_cutoff`, `stage_at_cutoff` and `area_at_cutoff` are end-of-dataset attributes, not historical states for every selected date.

Waiting and occupied counts can overlap: a boarding patient may occupy a bed while awaiting transfer. Do not add them as separate populations. Arrivals/departures are additive over time; patient census/occupied beds are snapshots and should not be summed as unique patients/beds.

## 11. Synthetic dataset generator

Source: [scripts/generate-dataset.mjs](../scripts/generate-dataset.mjs). Run explicitly with `node scripts/generate-dataset.mjs`; starting the app does not regenerate data.

The generator starts at 29 August 2026 00:00 IST, ends at 28 September 2026 00:00 IST, and uses fixed seed `28092026`. It simulates 720 hours with initially empty census. Its distribution assumptions are fictional, not calibrated hospital statistics.

### Functions and helpers

| Helper | Implementation and reason |
|---|---|
| `random()` | Seeded linear congruential pseudo-random generator using `Math.imul` and unsigned arithmetic. Makes output reproducible. |
| `integer(low, high)` | Converts the seeded draw to an inclusive integer range. |
| `local(t)` | Adds the fixed 330-minute IST offset and produces offset-free `YYYY-MM-DD HH:mm:ss` text for dataset exports. The importer must interpret it explicitly in IST. |
| `reserve(area, ready, duration)` | Chooses the earliest-free bed, breaking ties by ID; starts at the later of ready/free time, advances bed availability and returns bed/start/end. This prevents overlapping allocations. |
| Nested `add(stage, area_id, from, to, bed_id = '')` | Adds a stage segment only when its duration is positive. |
| `escape(v)` | CSV-escapes fields by quoting/doubling quotes; null becomes an empty field. |

### Main generation stages

1. Define six areas and the four staffed-bed pools (4+18+12+10 = 44 beds).
2. Generate sorted arrival instants by hour. Overnight volume is smaller. Selected daytime periods get additional surge arrivals.
3. For each arrival, choose fictional urgency, initial care area, registration/triage/pre-assessment timing and care duration. Reserve a bed and build a continuous path through stages. Some visits reserve a boarding bed before discharge.
4. Clip observations to the cutoff. Export only observed starts/outcomes; ongoing stage ends and future departures remain blank.
5. For each hourly boundary, identify active segments and waiting stages. Compute area occupancy/overflow, department census, waiting average and high-acuity count. Count arrival/departure events in the preceding hour.
6. Create the 30 reporting-date records.
7. Assert unique visit IDs, continuous paths, non-overlapping bed assignments, no staffed-bed overflow and hourly conservation: previous census + arrivals − departures = new census.
8. Write six CSVs, combined `dataset.json` and `manifest.json` with provenance, row counts and latest snapshot.

Current output: 6 areas, 30 dates, 3,015 visits, 19,249 stage events, 720 department hours and 4,320 area snapshots. Triage/waiting spaces can overflow; staffed-bed allocation cannot. The generator rewrites generated dataset files but does not import them, reset PostgreSQL, update Power BI or regenerate the separately exported Excel workbook.

## 12. Power BI model and report builder

Open `powerbi/AcuityCompass.pbip` with the sibling `.Report` and `.SemanticModel` folders intact. Power BI owns rendering and DAX execution; React does not draw these report visuals.

### Project files

`AcuityCompass.pbip` points to the report. `.Report/definition.pbir` references the semantic model. `.Report/definition/` contains report/page/visual metadata; individual visual JSON files describe type, coordinates, styling and bound fields. `.SemanticModel/definition.pbism` supplies model metadata; `model.bim` contains tables, columns, Power Query partitions, relationships and DAX measures. Desktop may add metadata on save. `.pbi` caches are machine-specific and ignored.

### Source tables and relationships

Five Power Query import tables are used: dates, areas, department_hourly, area_capacity_hourly and visits. SQL selects only the needed columns; timestamps are converted with `AT TIME ZONE 'Asia/Kolkata'`. Power Query sets date/datetime, integer, number and text types. A hidden triage_order column sorts Red through Blue logically.

There are four active many-to-one, single-direction relationships: department_hourly.report_date → dates.report_date; area_capacity_hourly.report_date → dates.report_date; visits.arrival_date → dates.report_date; area_capacity_hourly.area_id → areas.area_id. No direct fact-to-fact relationship is introduced. Flow events are used by the application but are not imported into this Power BI model.

### All eleven DAX measures

| Measure | Formula/logic and meaning |
|---|---|
| Total arrivals | `SUM(department_hourly[arrivals])`; additive over selected dates. |
| Total departures | `SUM(department_hourly[departures])`; additive over selected dates. |
| Latest snapshot | `MAX(department_hourly[snapshot_time])` in the current filter context. |
| Active patients | At Latest snapshot, take MAX active_patients; return BLANK if no snapshot. MAX selects the one snapshot value rather than adding census across hours. |
| Patients waiting | Same pattern using patients_waiting. |
| Bed occupancy | At Latest snapshot, divide occupied_beds by staffed_beds with DAX `DIVIDE`; display two decimal percent. |
| Area bed occupancy | At Latest snapshot, sum occupied and staffed capacity for `is_bed_area = 1` under the current area/date filters; divide and display one decimal percent. |
| Visit count | `COUNTROWS(visits)`; used for arrival-cohort urgency, respecting arrival date filters. |
| Current queue average wait | At Latest snapshot, select recorded average_elapsed_wait_minutes; not an average across every hourly mean. |
| Average wait to assessment | `AVERAGE(visits[wait_to_assessment_minutes])`; averages observed nonblank visit assessment waits. |
| Snapshot label | Returns “No records loaded” for a blank snapshot; otherwise formats snapshot date/time with IST and historical synthetic-data text. |

Not every measure appears as a visible card; the model includes reusable wait measures. The complete executable DAX is in `model.bim` and the `measures` array in the builder.

### `scripts/build-powerbi.mjs` functions

| Function/helper | Purpose |
|---|---|
| `write(name, value)` | Creates parent folders and writes formatted JSON under `powerbi/`. |
| `schema(kind, version)` | Builds Microsoft's versioned PBIR JSON-schema URL. |
| `field(table, name, type)` | Produces a Column or Measure expression pointing to a model entity. |
| `projection(table, name, type = 'measure', label = name)` | Adds query reference/display metadata around a field for a visual role. |
| `lit(value)` | Wraps strings/numbers as literal expressions, escaping string quotes. |
| `color(c)` | Wraps a literal colour in Power BI's solid-colour expression shape. |
| `format(properties)` | Produces the array-of-properties wrapper expected by visual formatting objects. |
| `visual(name, type, title, x, y, width, height, roles = {}, objects = {})` | Creates a visual definition with position, tab order, query-role projections, title/background/border formatting; pushes it into the visuals list and returns it. |
| `text(name, content, x, y, w, h, size = 12, colorHex = ...)` | Uses `visual` to build a text box, adds text runs and removes its data query/title/background decoration. |

Top-level builder code converts table definitions into typed import partitions and attaches the measures to department_hourly. It generates relationships, report metadata and a 1280×850 overview page. Its twelve visuals are title, subtitle, date slicer, four KPI cards, daily flow line chart, area occupancy bar chart, urgency bar chart, snapshot card and footer.

The date slicer filters the report. Chart-to-other-visual cross-filtering is deliberately disabled with `NoFilter` interactions: an arrival-cohort urgency selection should not misleadingly filter unrelated department snapshot measures. Report selections also do not control React's operational queue.

**Do not run this builder casually after Desktop edits. It overwrites authored files.** To change the report, choose Desktop editing or intentionally regenerating it with backed-up changes. The builder does not open Desktop, refresh, publish or create embed codes.

### Refresh and embedding

Power BI imports data when refreshed. React Refresh rereads the API; Power BI Desktop Refresh rereads PostgreSQL; publishing updates the online copy; iframe Reload only reloads the view. These four actions are different. Automatic cloud refresh from the laptop is not configured. The public embed is pending administrator permission; private embedding has separate account and hosting requirements described in [POWER-BI-UI.md](POWER-BI-UI.md).

## 13. Setup, maintenance and validation scripts

### Windows lifecycle

`scripts/setup-local.ps1` changes to the project root, checks for Node and the `pg` dependency, downloads the pinned PostgreSQL Windows binaries if absent, extracts needed runtime folders, runs setup-database and applies migrations. It does not install a Windows service. Its error text mentions an older Node minimum; follow package.json's 22.18+ requirement instead.

`scripts/setup-database.mjs` creates local log folders and random administrator/application/report passwords if needed, initializes the local database cluster with SCRAM authentication, configures loopback/5433/IST, starts PostgreSQL when stopped and creates missing application/reporting roles and database. It creates `.env` only when absent. `run(name, args)` invokes a PostgreSQL executable using `spawnSync`, hides its window and throws on nonzero status. A temporary init-password file is removed in `finally`. Existing credentials and database data are preserved; changing credentials manually requires explicit reconciliation, not simply rerunning setup.

`scripts/start-local.ps1` ensures PostgreSQL is running, locates Node, then starts API and Vite in hidden background processes with redirected logs. Existing listeners on 3001/5173 are left alone. Started process IDs go to `.local/api.pid` and `.local/web.pid`. An occupied port does not prove it belongs to this project.

`scripts/stop-local.ps1` reads tracked PID files, checks process name and expected command fragment, stops matching Node processes, removes PID files and asks this PostgreSQL cluster to stop in fast mode. It does not delete the database. Servers started manually may not be tracked by this script.

### Reporting validation

`scripts/validate-powerbi.mjs` uses AJV with an asynchronous `loadSchema(uri)` callback that fetches referenced schemas and rejects failed HTTP responses. Its recursive `files(dir)` returns file paths. It parses eligible JSON/PBIP/PBIR/PBISM files, validates those declaring `$schema`, prints failures and sets a failed exit code. This validates file structure, not DAX results or visible layout.

`scripts/check-powerbi-data.mjs` reads local reporting credentials, extracts each model partition's SQL, executes it as `acuity_report`, checks exact returned column names and relationship references, verifies expected original-dataset totals and writes `powerbi/validation-results.json`. It always closes its pool. Its M-query extraction assumes the builder's quoted `Query="..."` structure and must be adapted if Desktop changes that representation. Its expected numbers are specific to the original dataset.

The generated validation JSON's `notVerified` entries describe what that script cannot verify, and can still list Desktop checks even though Desktop/Service were subsequently checked manually. Treat script output and manual verification as separate evidence.

## 14. Tests and verification

`tests/dashboard.test.ts` contains three scenario tests plus two rule/freshness tests. It verifies deterministic generation at a fixed time, unique IDs, stage/queue/capacity totals, bed assignment counts, elapsed/wait consistency, generated alert equality and linked tasks. It checks normal versus high-demand triggers and freshness boundaries at 0, 5, 20 and 21 minutes. Its local `iso(minutes)` helper constructs timestamps for those boundary cases.

`tests/powerbi-config.test.ts` validates accepted Microsoft URLs and rejected HTTP/spoofed-host/invalid-ID/credential cases. Its public-link test verifies that only the `r` embed code survives normalisation. It does not access Power BI or verify an actual public link. Together with the new stage-timing test, the frontend-side command runs **eight tests**.

`backend/tests/integration.test.ts` runs one lifecycle test against a fresh `acuity_test_<timestamp>` PostgreSQL database. It calls migrations twice, checks empty response, imports and reconciles data, validates timestamps/totals, confirms acknowledgement/task persistence, rejects unsafe origins/unknown IDs/stale snapshots, checks idempotent import, checks reporting-role reads and denied writes, and simulates a stopped pool to assert a 503 response. Local `get()` and `patch(body, origin?)` helpers call the temporary server. A temporary hourly-data change creates an alert for testing; it affects only that test database. Cleanup closes resources and drops that generated database.

```powershell
npm test
npm run check:backend
npm run build
npm run test:backend
```

The backend test needs the local PostgreSQL setup and machine-local test credentials. Power BI validation commands are separate. Passing TypeScript/build does not prove a hospital integration or embed works. A previous frontend build also reports a nonfatal large-chunk warning; code splitting is a future performance improvement. This guide was written from source inspection; no database reset, generator execution or production deployment was needed to create it.

## 15. Worked examples of data flow

### Opening the dashboard

1. Browser loads `index.html` and `main.tsx`; React renders `App`.
2. Default source `database` triggers the loading effect.
3. `getDatabaseDashboard()` fetches `/api/dashboard`.
4. Vite proxies to the Node server; `createApi` calls `getDashboard`.
5. The backend reads a consistent database snapshot, maps records, calculates alerts and merges saved action states.
6. React stores `result.data`; `calculateMetrics` derives the cards, and components render the records.

No imported snapshot gives a successful empty state. Database failure gives an error. There is no silent replacement with demo numbers.

### Clicking a patient and acknowledging an alert

Clicking Active patients calls `open('patients')`. The modal renders `PatientQueue`, whose search/filter/page controls work locally. Clicking an ID sets selected patient; `PatientDetails` renders the recorded timeline. No database write occurs.

Clicking Mark as seen in database mode calls `acknowledge` → `persistAction` → `saveDatabaseAction` → PATCH handler → `saveAction`. The backend verifies snapshot and alert, upserts acknowledgement, then returns fresh data. A subsequent refresh rereads the saved state. In a demo, only React state changes.

### Reproducing the occupancy card

Latest areas contain 6 occupied beds among the four bed areas with total capacity 44. `calculateMetrics` returns `Math.round(6/44*100)` = 14. DAX `DIVIDE(6,44)` formatted to two decimal percent gives 13.64%. The difference is presentation precision, not a different denominator. Triage and Waiting Area spaces are excluded from both.

## 16. Running and sharing the project

On another Windows laptop with a compatible Node/npm installation, from the project root:

```powershell
npm ci
./scripts/setup-local.ps1
npm run db:import
./scripts/start-local.ps1
```

Open `http://127.0.0.1:5173/`. API health is `http://127.0.0.1:3001/api/health`. PostgreSQL is `127.0.0.1:5433`, database `acuitycompass`. Each teammate should create their own credentials through setup. Power BI Desktop is needed only to author/refresh the report, not to run React.

Daily start/stop uses the two lifecycle scripts. Closing a tab does not stop background services, and rebooting does not automatically restart them. To run manually, use `npm run api` and `npm run dev` in separate terminals after starting PostgreSQL. `npm run preview` serves built frontend files; it is not the documented local API development setup.

| Symptom | First check |
|---|---|
| Site cannot be reached | Start services and read `.local/logs/web-error.log`. |
| Backend unreachable | Check API health and `.local/logs/api-error.log`. |
| Database unavailable | Check PostgreSQL status/log, local configuration and migrations. |
| No records loaded | Import the supplied dataset; this differs from a failed connection. |
| Numbers do not change after Refresh | Historical snapshot is fixed; Refresh does not generate arrivals. |
| Demo edits disappear | Expected in-memory behaviour; use database mode for persistence. |
| Power BI asks for database credentials | Use that laptop's `acuity_report` credentials, not the administrator account. |
| Public embed cannot be created | Organisation administrator must permit Publish-to-web code creation; no URL exists yet. |

Share the source folders, SQL migrations, dataset, Power BI definitions, package/lock/config files, `.env.example`, docs and font licences. Exclude `.env`, `.local`, `node_modules`, `dist`, logs and Power BI `.pbi` caches from a ZIP. Do not share the PostgreSQL cluster folder as the dataset. The synthetic export files are the portable input.

## 17. Where to change things

| Requested change | Files to start with | Follow-through |
|---|---|---|
| Page layout, cards or drawer choices | `src/App.tsx`, `src/dashboard.css` | Check desktop/mobile layout and drawer focus/close behaviour. |
| Shared table/badge styling | `src/styles.css`, `Common.tsx` | Check queue, capacity and alert panels together. |
| Patient search or fields shown | `PatientQueue.tsx`, `types/dashboard.ts` | If data is new, also extend backend mapping and SQL source. |
| Waiting/occupancy definition | `calculateMetrics.ts`, generator, reporting model | Keep database aggregates, React and DAX consistent; update tests. |
| Alert threshold | `alertRules.ts` and sometimes `calculateMetrics.ts` | Update explanatory UI text/tests; not every threshold is centralised. |
| API endpoint or write action | `backend/src/app.ts`, relevant backend function, API client | Add server validation and an integration test for persistent effects. |
| Database schema | New numbered migration | Preserve existing records; update importer/generator/model when fields change. |
| Synthetic volume/dates | `scripts/generate-dataset.mjs` | Regenerate intentionally, import into a separate database for changed data, refresh report and adjust fixed expectations. |
| Report appearance | Power BI Desktop or intentional builder edits | Do not regenerate over unpreserved Desktop changes. |
| Public embed connection | `.env` URL after admin enables it | Restart Vite/rebuild; verify actual report rendering, filters and operational controls. |
| Patient registration or transitions | New backend write workflow plus small React forms | Also implement event/aggregate consistency; changing a single table is insufficient. |

Suggested team ownership: frontend, backend/database, dataset/testing and Power BI/documentation. Agree on the shared metric definitions and object contracts before each person changes their part. If this folder is not yet under version control, initialise a team repository separately and review exclusions before uploading anything.

## 18. Limitations and future work

This is a local student demonstration, not a production hospital deployment. It has no login/authorisation, user audit trail, live hospital connector, ingestion scheduler, editing forms or predictive model. Origin checks and loopback binding are useful local boundaries but not substitutes for production access control. Public Power BI approval applies only to fictional data, not future real patient records.

Database writes affect acknowledgements, task status and snapshot-scoped transfer follow-up history. They do not change patient movements. The importer rejects a different dataset in a populated database. Directly editing visits without rebuilding matching events/snapshots can create inconsistent figures. A future ingestion feature needs validated events, duplicate handling, transactional updates and a reliable aggregate-refresh design.

There is no API polling or websocket feed. The ten-second timer updates demo freshness only. Power BI is an imported snapshot, and public embedding remains blocked externally. Even when enabled, iframe selection does not drive React state and chart interactions inside the report are intentionally limited.

Some code assumes a complete six-area dataset with positive capacity/history. Examples include mandatory Observation lookup and chart divisions for an empty patient list. Null empty-state handling covers the current no-import case, but a future legitimate ready snapshot with zero patients needs explicit chart edge-case handling. New generic uploads require much stronger validation than TypeScript types and current import checks.

The average elapsed wait card measures time since arrival among patients awaiting a next stage. The flow chart separately measures time since the current stage began. Both end at the historical snapshot. No actual transfer-request timestamp is available. A long stage duration does not establish its cause.

An eventual hospital workflow could receive registration/triage/transfer/discharge events from an existing system, or accept them through staff forms. The backend would save and recalculate automatically. Those are future workflows; staff are not expected to maintain SQL manually.

## 19. Glossary and presentation questions

| Term | Meaning in this project |
|---|---|
| Component | A reusable React function that returns UI. |
| Props | Inputs passed into a component. |
| State | Values React remembers between renders, such as selected source. |
| Effect | Work tied to lifecycle/dependency changes, such as loading data. |
| API | HTTP boundary through which browser code requests or updates data. |
| Pool | Reusable set of database connections. |
| Transaction | A unit of database work committed together or rolled back. |
| Migration | Versioned SQL change applied once per database. |
| View | Named SQL query presenting data from underlying tables. |
| Snapshot | State at a particular recorded instant, not a continuously live feed. |
| Grain | What one row represents, such as one visit or one area/hour. |
| Power Query | Power BI's data-loading/transformation layer; written in M here. |
| DAX | Power BI formula language for measures evaluated under filters. |
| Semantic model | Tables, relationships, types and measures used by report visuals. |
| iframe | Browser frame displaying the separate Power BI web report. |

**Where do the numbers come from?** The default page reads imported synthetic records through the API. Demo modes use separate generated examples. Power BI imports the same database reporting data.

**What is saved when I click a button?** Searching and opening details do not write. Database-mode acknowledgement/task updates and transfer follow-up entries are saved. Demo actions are temporary. Patient registration is not implemented.

**Why are React and Power BI both used?** React provides the application interactions and operational record access; Power BI supplies historical reporting. The embed is prepared but awaiting administrator permission, so both are currently demonstrated separately.

**How will staff add arrivals later?** Through hospital-system events or a future staff form, with backend updates. This version uses a generated dataset and controlled import rather than staff entry.

**Is this AI or real-time?** Neither in the current implementation. Alerts are explainable deterministic rules, and database records are historical synthetic snapshots.

**Which file should a teammate read first?** This guide for context, then `src/types/dashboard.ts` and `src/App.tsx`; follow the service into the backend to trace a real request.

## 20. Transfer coordination and stage timing (1 October 2026)

### Recorded timing

`Patient.stageStartedAt` and `stageMinutes` are optional. `readDashboard` finds the flow event active immediately before the snapshot boundary and calculates rounded minutes from its `stage_start` to the snapshot. These fields are separate from legacy `waitingMinutes`, which keeps the existing average-wait and Power BI definitions unchanged. `createScenario` supplies explicitly illustrative stage durations. Missing timings remain unknown in charts and patient details.

### Transfer follow-up UI

`src/components/TransferFollowups.tsx` exports `TransferFollowups({data,database,onSave})`. It lists patients in Awaiting Bed, finds each patient's most recent entry in descending-ID history, and optionally filters out Closed items for handover. Selecting a patient opens `FollowupEditor`, keyed by patient and latest entry ID so successful saves reset the note and load the new version. All values are rendered as React text, not HTML.

`FollowupEditor` controls blocker, owner, status and note. Submission calls `onSave` with the current entry ID (or zero). The form requires a nonblank note and an assigned team when progressing or closing work. Failed saves retain the entered values and show an error. History preserves prior notes, status and recording time. Ownership names identify teams, not authenticated users.

`App.saveFollowup` calls `saveDatabaseFollowup` in database mode and replaces the returned dashboard. Demo mode prepends an in-memory entry with a monotonic ID and current recording timestamp. `open('transfers')` opens the existing single-page dialog. There is no new navigation page.

### Backend and storage

`saveDatabaseFollowup` sends PATCH `/api/followups`. `createApi` applies the existing JSON-body and origin checks. These are not authentication.

`backend/src/followups.ts` exports `saveFollowup(pool,body)`. It validates snapshot, patient, allowlisted blocker/team/status, expected integer version, note length (1–500 trimmed characters), and ownership for non-Open states. A transaction takes a patient-specific advisory lock before reading the current snapshot. Only an active Awaiting Bed patient is eligible. A different snapshot returns 409; a changed latest history ID returns 409 rather than silently overwriting another update. The function inserts with parameterized SQL, rereads the dashboard, commits, and releases the connection; failures roll back.

Migration `003_transfer_followups.sql` creates append-only `transfer_followups`: identity ID, snapshot and visit foreign keys, constrained blocker/owner/status, note and recording timestamp. `readDashboard` maps these rows to `TransferFollowup[]` newest first. Closing a follow-up never changes visits, flow events, occupied beds or departure totals. Reopening creates another history entry. This is snapshot-scoped coordination history, not an authenticated audit trail or a live clinical workflow.

### Tests, presentation and remaining work

The frontend-side suite now contains eight tests, including an explicit check that stage duration differs from arrival elapsed time and missing data is unknown. The backend lifecycle test checks recorded stage timings, follow-up persistence and history, invalid inputs, stale edits, disallowed origins and unchanged patient records after closure.

`Start AcuityCompass.cmd` starts local services and opens the website. The Power BI owner link opens a separate report; local charts continue working without embed permissions. Power BI Desktop remains the local reporting presentation option. The existing Power BI model does not yet analyse the new follow-up table. Forecasting, hospital feeds, actual transfer-event entry and authentication remain future work.

## 21. Interactive patient entry (1 October 2026)

### Data isolation and schema

Migration `004_interactive_patients.sql` adds `interactive_visits` and append-only `interactive_events`, separate from historical `visits`, `flow_events` and hourly snapshots. Visits hold generated DEMO IDs, UUID request IDs for retry deduplication, arrival timestamp and arrival method. Events hold stage, recorded triage, area, optional bed number, event time and recording time. Synthetic-only constraints and foreign keys apply. Capacity uses the existing area configuration, but occupancy counts only interactive visits. The historical report and patient snapshots are not rewritten.

### Backend functions

`backend/src/interactive.ts` has private `read(client)`: load interactive visits/events and areas, map the newest event first for each visit, and derive occupied beds from latest non-departed events. It returns `asOf`, visits with complete history, and area capacity. No hourly aggregates are stored; the small local demonstration recomputes counts from current events on each read.

`getInteractive(pool)` wraps those reads in a consistent REPEATABLE READ transaction. `writeInteractive(pool, body)` handles register/event commands in a transaction, taking advisory lock 7234092 to serialize demo occupancy changes. Registration validates arrival within the last 30 days, supported method/triage and a non-bed initial area. A UUID request ID prevents retry duplication. The initial Registration event occurs at the supplied arrival time; recording time is now.

Event updates require the latest event ID (`expectedId`) to reject stale edits, an allowed transition, a triage category before Waiting/Assessment/Treatment/Awaiting Bed, valid area and bed bounds, and no competing active allocation of the same bed. Event time is server time when saved. Departed stages force the bed to null and permit no further updates. Failed writes roll back. Bed and patient data are not inferred from free-text notes.

`createApi` exposes GET `/api/interactive` and POST `/api/interactive`. POST uses the same origin and JSON size checks as other writes. Invalid fields return 400; stale edits or occupied beds return 409. These local checks do not provide user authentication.

### Types and frontend

`src/types/interactive.ts` declares independent types, including Not assessed triage and terminal Discharged/Transferred stages, so the historical model is unchanged. `nextStages` defines the simplified allowed state transitions. `isDeparted` identifies terminal events. `currentStageStart` walks contiguous newest-first events of the current stage so a bed/triage edit does not reset stage duration.

`InteractivePatients` in `src/components/InteractivePatients.tsx` owns data, pending/error/success status, add-form selection, selected visit and departed filter. `request` handles API JSON and a ten-second timeout; `refresh` rereads records; `save` submits a command and replaces the data only on success. It derives active, awaiting-assessment, occupied and departed counts. `Register` controls arrival/method/triage/area with a stable UUID for retries. `Update` offers allowed stages and available beds, records an update, and renders retained event history. Forms disable while saving; errors preserve entered values. `format` displays timestamps in Asia/Kolkata, while `localNow` sets datetime-local inputs in the laptop's timezone.

`App` adds an interactive source option and entry button. It skips historical loading in this mode and renders the interactive workspace at the same URL. Returning to historical mode restores the existing dashboard. Refreshing the browser defaults to historical mode, but reopening interactive mode rereads saved records.

### Verification and limitations

The backend integration test now also registers a patient, retries without duplication, rejects future arrivals, disallowed origins, skipped stages, stale writes, missing assessed triage and invalid/occupied beds; it checks bed release, retained departure history and unchanged historical patient counts. A separate frontend-side unit test checks same-stage timing, bringing that suite to nine tests.

This is a small local synthetic workflow. It has no login, real hospital feed, polling, backdated stage updates, event corrections or editing of a departed visit. The existing Power BI model does not import interactive tables. The historical follow-up drawer is not linked to interactive visits. A hospital-ready event model, roles, corrections and reporting integration remain separate work.

## 22. Main-page patient-entry integration

`App` always renders the main dashboard. The header's plus button selects interactive records and opens `entry` in the existing dialog. Loading this source calls exported `requestInteractive`, then `interactiveDashboard` to adapt saved records to the common `DashboardData` structure. `InteractivePatients` now renders panel content, accepts `initialAdd` and an `onData` callback, and reports loaded/saved records to the parent. It no longer replaces the main page. Unmount checks prevent a completed save from replacing another source after the panel closes.

`src/utils/interactiveDashboard.ts` excludes terminal visits from active counts, maps current stage/time/triage/bed and complete timelines, maps area capacity, and constructs twelve IST-aligned hourly arrival/departure buckets from saved event timestamps. It generates rule-based warnings from the adapted data. The shared triage type and chart legend include Not assessed; empty urgency charts show zero percentages rather than NaN.

Patient cards in interactive mode open the movement editor. Saving updates the main overview immediately. Interactive warnings are read-only; historical alert actions and transfer follow-up history remain separate workflows. The existing Power BI report still imports only the historical dataset. This change establishes the website-to-API-to-database-to-main-dashboard loop, not automatic BI refresh or unrestricted public embedding.

`tests/interactive-dashboard.test.ts` checks that registration increases active/waiting counts, assessment and bed assignment update occupancy and stage duration, and discharge removes the active patient and increments departures. The frontend-side suite now has ten tests.

## 23. Power BI connection to website entries

Migration `005_interactive_reporting.sql` creates `reporting.interactive_patients`. It selects each visit's latest event, returns arrival/movement timestamps in Asia/Kolkata, and computes active, waiting, occupied and departed indicator columns. Capacity is the total configured bed-area capacity. A left join retains a single blank sentinel row when there are no visits so capacity and zero counters remain available. `COUNTA(visit_id)` excludes this sentinel. `refreshed_at` is the database query time. The view grants the existing reporting role SELECT only; credentials remain outside report files.

The semantic model imports this view as `interactive_patients` using PostgreSQL navigator access rather than a new native SQL approval prompt. The table is independent of the historical dates/areas relationships. Measures count entered visits, sum active/waiting/occupied/departed flags, divide occupied by MAX capacity, and format the refresh timestamp. Do not sum repeated capacity values.

The **Website patient entries** report page contains five cards, a patient table including departures, a refresh label and instructions. All values come from the same imported table, ensuring consistent counts within a refresh. **ED overview** retains the original historical report. Desktop Home > Refresh imports website changes; no streaming, cloud refresh or public embed is implied. The online report requires a separate republish to include this new page.

`scripts/connect-interactive-powerbi.mjs` adds/replaces only the interactive table and page and selects it as the opening page. It backs up the existing model and report definitions under `.local` before writing. Its helpers construct projections, clone existing visual styles and write PBIR JSON. Avoid running it while unsaved Desktop changes exist. The original full builder still overwrites the model and should not be used for routine updates.

The backend lifecycle test verifies the reporting view's empty state and reconciles entered/active/waiting/occupied/departed totals after registration and departure. Desktop refresh is verified separately because SQL tests alone cannot establish report rendering or M/DAX execution.

## 24. Coordinator admission and departure workflow

Patient registration & movement remains inside the main dashboard dialog. Open a visit ID and choose a Coordinator action. Assessment/Treatment can move to Awaiting Bed (request admission); that is still an active ED visit and its existing bed stays assigned by default. From Awaiting Bed, Admitted records physical departure to an inpatient ward. Discharged, Transferred (another hospital), and Left before completion also end the ED visit. All departures clear bed_number, leave the event history intact, and cannot be edited further in this MVP.

`src/types/interactive.ts` defines allowed transitions and the shared isDeparted predicate. `src/components/InteractivePatients.tsx` supplies readable action labels, destination inputs, departure confirmation, and event history. `backend/src/interactive.ts` validates transitions and required ward/hospital destinations, timestamps changes, and commits them transactionally. `database/migrations/006_coordinator_departures.sql` adds destination and the two new stages, and updates reporting.interactive_patients so Power BI counts match the API. The reporting view keeps its existing columns to avoid requiring a Power BI model change: destination is displayed in the website history; Power BI displays the resulting stage and counts. The Completed departures card counts all departures, including leaving before completing care; it does not imply completed treatment.

Tests in backend/tests/integration.test.ts verify admission retains the bed, ward departure releases it, required destinations, blocked post-departure edits, and reporting reconciliation. Power BI Desktop still needs Home > Refresh on Website patient entries.

### Finding and updating patients
The patient panel now supports case-insensitive partial visit-ID search, current-stage and area filters, a matching-record count, and Clear filters. Active visits are shown by default; Include all departed visits adds historical entries with View history buttons. Each active row has an explicit Update patient button. Selecting it opens the form above the records list and moves keyboard focus and scroll position to the editor. Filtering is local to the loaded demo records; this is not server-side pagination for a hospital-scale deployment.

## 25. Combined operational patient list (supersedes earlier isolation notes)
The default dashboard now uses one editable operational ledger containing the original 3,015 synthetic visits plus website entries. Nine visits were active at the September cutoff; they remain active until coordinators record departure. Original timestamps are preserved, so elapsed times continue from September, not a simulated new arrival today. Historical snapshot tables and ED overview trends remain unchanged.
Migrations 007–009 define seed_operational_patients, copy original visit/event histories once, preserve discharge preparation as active, and mark historical departures as Departed because the source does not specify the outcome. Unknown arrival methods are labelled Not recorded. Import runs the seeding function for a fresh setup; repeated calls do not overwrite movements or resurrect departed patients. Bed numbers are preserved and participate in the same occupancy checks as website entries. The existing Power BI Website patient entries page now reads the combined ledger after Refresh. Its historical ED overview remains a fixed September snapshot.
Search defaults to active visits across BOTH origins; Include all departed visits also searches completed historical visits. API integration tests check 9 original active patients/6 occupied beds, editing an original visit, unchanged historical snapshots, and idempotent seeding.

## 26. Unified Power BI dashboard (supersedes the two-page layout)
The one visible page is Combined ED dashboard. It uses reporting.interactive_patients for combined visit counts/current state, reporting.operational_daily for arrivals and actual departures by IST calendar day, and reporting.operational_areas for current occupancy and staffed bed capacity. These views include original dataset and website-entered visits exactly once. Cards are all-record/current-state metrics, without a date slicer; charts do not cross-filter them. No real-time refresh is claimed: use Home > Refresh in Desktop. scripts/build-combined-powerbi.mjs preserves a local backup before rebuilding. The legacy two-page builders should not be used for the current report.

