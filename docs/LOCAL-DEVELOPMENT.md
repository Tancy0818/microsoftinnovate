# Local development

## Daily use

Run `./scripts/start-local.ps1` from the project root in PowerShell. Open http://127.0.0.1:5173/. Run `./scripts/stop-local.ps1` when finished.

| Service | Address |
|---|---|
| React / Vite | http://127.0.0.1:5173 |
| API health | http://127.0.0.1:3001/api/health |
| PostgreSQL | 127.0.0.1:5433, database `acuitycompass` |

The scripts use the Node.js executable on PATH. In this Codex workspace Node is provided by its bundled runtime. If your own terminal cannot find `node`, install Node.js 24 LTS or add your installed Node location to your user PATH. VS Code and PyCharm are not required.

`start-local.ps1` preserves already-running processes on occupied ports and reports that fact. A foreign process on 3001 or 5173 must be resolved before using the app. `stop-local.ps1` stops only tracked app processes and this project's PostgreSQL cluster. Older servers started manually are not tracked.

## Setup and storage

`./scripts/setup-local.ps1` downloads the Windows archive linked by [EDB](https://www.enterprisedb.com/download-postgresql-binaries), initializes `.local/pgdata`, generates passwords, starts PostgreSQL and applies SQL migrations. PostgreSQL's [Windows download page](https://www.postgresql.org/download/windows/) links to EDB binaries.

- `.env`: application database connection; do not share or commit it.
- `.local/database-credentials.json`: local setup credentials, including the cluster administrator; ignored by Git.
- `.local/pgdata`: persistent database files. Do not delete these as a routine cleanup.
- `.local/logs`: PostgreSQL, API and Vite output.
- `.local/downloads` and `.local/pgsql`: downloaded archive and executable runtime.

Re-running setup does not overwrite an existing `.env`, reset passwords or clear data. The application account owns this development database but is not a cluster superuser. This is a local demonstration setup, not an authenticated production deployment.

## Commands

- `npm run api`: start the backend in the current terminal.
- `npm run dev`: start Vite separately; its `/api` proxy points to port 3001.
- `npm run db:migrate`: apply pending migrations transactionally.
- `npm run db:import`: import `dataset/dataset.json` with explicit Asia/Kolkata timezone handling.
- `npm run check:backend`: type-check backend code.
- `npm run test:backend`: run integration tests in a new disposable database.
- `npm run build`: type-check React and build `dist/`.

The plain `npm run preview` command previews compiled frontend assets only; use the Vite development server for the configured local API proxy. Production hosting/reverse-proxy configuration is not included.

## Troubleshooting

**Site cannot be reached:** run the start script, then inspect `.local/logs/web-error.log`.

**Backend unreachable:** check `.local/logs/api-error.log` and the health URL.

**Database unavailable:** run setup/migrations and check `.local/logs/postgres.log` and `.env`. A stopped database does not erase the records.

**No records loaded:** the connection succeeded but no dataset has been imported. Run `npm run db:import` and refresh.

**Historical snapshot:** expected for the synthetic data. Refresh reads PostgreSQL again; it does not advance the dataset clock or fabricate current activity.

The UI retains separate labelled demo scenarios for presentations. Demo acknowledgements reset; PostgreSQL acknowledgements persist across refreshes and restarts.
