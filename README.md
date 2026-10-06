# AcuityCompass

A single-page React dashboard for fictional emergency-department operations, connected to a Node.js/TypeScript API and a local PostgreSQL database.

## Teammate code guide

Read [CODEBASE-GUIDE.md](docs/CODEBASE-GUIDE.md) for the complete module/function walkthrough, React state and data flow, API contracts, SQL schema, synthetic generator, Power BI measures, tests, setup and known limitations. This is the shareable technical handover document.

## Start and stop

Use the header **Add patient** and **Update patient** buttons. Historical synthetic visits and website entries share the combined operational list. Registrations and movements persist in PostgreSQL and appear in Power BI after Desktop refresh.

For a presentation, double-click **Start AcuityCompass.cmd**. Follow [the teacher-demo walkthrough](docs/TEACHER-DEMO.md) to demonstrate saved transfer follow-ups and Power BI Desktop separately. Public embed permission is not required for the website's local charts.

From this folder in PowerShell:

```powershell
./scripts/start-local.ps1
```

Open **http://127.0.0.1:5173/**. Select **PostgreSQL · Synthetic dataset** for imported database records. The other three demos are separate in-memory examples.

```powershell
./scripts/stop-local.ps1
```

Services run in the background. Closing the browser does not stop them. They do not automatically start after a laptop restart; run the start script again. Logs are in `.local/logs/`.

## Folder map

| Folder / file | Purpose |
|---|---|
| `src/` | React page, components, frontend API client and shared metric rules |
| `backend/src/` | HTTP API, PostgreSQL queries, migrations and importer |
| `backend/tests/` | Tests against a disposable PostgreSQL database |
| `database/migrations/` | Versioned SQL schema and Power BI reporting views |
| `dataset/` | Generated synthetic data and data dictionary |
| `scripts/` | Local setup/start/stop and dataset generation |
| `docs/` | Setup, API, architecture and Power BI instructions |
| `tests/` | Existing synthetic-scenario and rule tests |
| `outputs/` | Exported Excel workbook and dashboard previews |
| `.local/` | Ignored PostgreSQL binaries, database files, credentials and logs |
| `.env` | Ignored local settings; backend credentials stay server-side, but `VITE_` variables are browser-visible |
| `.env.example` | Connection-setting template without real credentials |

Start with [LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md). Read [BACKEND.md](docs/BACKEND.md) for API contracts and metric definitions, and [POWER-BI-SETUP.md](docs/POWER-BI-SETUP.md) for reporting.

## First setup on another Windows laptop

Install Node.js 22.18+ with npm (Node 24 recommended), then:

```powershell
npm ci
./scripts/setup-local.ps1
./scripts/start-local.ps1
```

Setup downloads the official EDB PostgreSQL 17.11 Windows binaries into `.local/`, creates a password-protected loopback-only instance on port 5433, a non-superuser application role, and the database schema. It does not install a Windows service or change global PostgreSQL settings. Setup leaves the database empty.

Import the synthetic records when ready:

```powershell
npm run db:import
```

The import is transactional and repeatable: the same dataset is skipped and a different dataset will not overwrite existing records. Refresh the dashboard after importing.

## Verification

```powershell
npm run build
npm run check:backend
npm test
npm run test:backend
```

The backend tests require the local PostgreSQL instance from setup. They create and remove their own temporary database, never clear the application database, and check empty responses, totals, timezone conversion, saved actions, invalid requests and database failures.

## Data and limits

The connected dataset contains **3,015 fictional visits over 30 days**, with its final snapshot at **28 September 2026, 00:00 IST**. The latest snapshot contains **9 active patients, 4 waiting and 6 of 44 staffed beds occupied**. It is historical synthetic data, not a live hospital feed. An empty database produces empty dashboard states; a failure produces an error without falling back to sample numbers.

The application is a local synthetic-data prototype. It includes a trained arrival forecast with chronological validation, editable resource assumptions, discrete-event action comparisons, targeted verification checks and persisted outcome tracking. See [PLANNING-AND-FORECASTING.md](docs/PLANNING-AND-FORECASTING.md). No authentication, hospital feed or clinically validated recommendations are implemented. Historical demand is labelled explicitly; sparse website entries are not treated as complete training hours. Power BI embedding remains subject to administrator permission.

## Power BI report project

The one-page report is authored in [powerbi/AcuityCompass.pbip](powerbi/AcuityCompass.pbip). See [powerbi/README.md](powerbi/README.md) for opening, credentials and refresh instructions. File schemas and PostgreSQL sources have been checked, and the report's expected headline values have been verified in Power BI Service after Desktop refresh and publication.

### Analytics integration

See [Power BI UI integration](docs/POWER-BI-UI.md). A configured private or approved public report can replace the local analytics preview; patient and alert controls remain on the same page. No public embed code has been created and no embed URL is configured yet.

