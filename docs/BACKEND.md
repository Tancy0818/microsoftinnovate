# Backend and database

## Architecture

React → Vite `/api` proxy → Node.js TypeScript API → PostgreSQL.

Power BI can read the same PostgreSQL reporting views. The API binds only to 127.0.0.1. Browser code receives no database credentials. All values are synthetic; there is no live ingestion service.

## Endpoints

| Method / path | Result |
|---|---|
| GET `/api/health` | 200 with `database: connected`; 503 on failure |
| GET `/api/dashboard` | A consistent snapshot containing queue, recorded visit timelines, area capacity, 12-hour history, alerts and tasks |
| PATCH `/api/actions` | Save a snapshot-specific acknowledgement or task status and return the refreshed dashboard |

A dashboard response includes `state`, `source: postgresql`, `synthetic: true`, and `data`. With no imported snapshot it returns `state: empty, data: null`. Database errors return HTTP 503 with a user-safe error, never a fake successful empty dataset.

Example action body:

```json
{
  "snapshotTime": "2026-09-27T18:30:00.000Z",
  "alertId": "acuity",
  "kind": "acknowledge"
}
```

For tasks, use `kind: task` and `status: Open`, `In Progress` or `Completed`. The server validates the alert against the latest snapshot. Invalid actions return 400; a changed snapshot returns 409. Snapshot writes are transactional and parameterized. The browser shows save failures and keeps the previous state. This local API has no login and must not be exposed publicly.

## Tables and reporting

`areas`, `dates`, `visits`, `flow_events`, `department_hourly` and `area_capacity_hourly` preserve the six dataset grains. Foreign keys connect them. `dataset_imports` records file hashes and provenance; `operational_actions` stores state keyed by snapshot and alert; `schema_migrations` tracks applied SQL files.

Views:

- `reporting.department_hourly`: hourly arrivals, departures and recorded snapshot KPIs.
- `reporting.area_capacity_hourly`: area snapshots with area names.
- `reporting.latest_patients`: active visit state derived from stage intervals at the latest snapshot.

The API reads the same reporting views. It uses a repeatable-read transaction so records from different imports cannot be mixed. Imports are all-or-nothing, skip identical files and reject replacement of an existing different dataset. These are historical snapshots: individual ingestion updates and automatic recalculation of historical aggregates are not implemented. Use the importer, not ad hoc edits to individual fact tables.

## Metric contract

- A snapshot describes the instant immediately before its timestamp.
- Active stage: `stage_start < snapshot AND (stage_end IS NULL OR stage_end >= snapshot)`.
- Waiting stages: Registration, Triage, Waiting, Awaiting Bed.
- Current queue wait: elapsed minutes from arrival to the snapshot, including previous stages. The UI rounds the average once to a whole minute.
- Bed occupancy: occupied spaces in bed areas divided by staffed beds; triage/waiting spaces are excluded. The UI rounds the percentage to a whole number.
- Waiting overlaps occupancy; do not add them.
- Departures and arrivals count events within each hourly `[start,end)` interval.
- PostgreSQL stores timestamps with timezone; source JSON wall-clock values are interpreted explicitly in Asia/Kolkata. UI and Power BI reporting dates use that zone.
- Imported patient timelines use actual synthetic stage records. Small built-in demos still use illustrative timelines.
- Staffing headcounts are unknown in this dataset and appear as `—`, never invented values.
- Historical snapshots do not trigger a misleading stale-live-feed alert. Separate stale-demo mode still demonstrates freshness alerts.

The same deterministic operational alert rules are shared between the API and frontend demos. They are illustrative thresholds, not clinical standards. No AI prediction is performed.
