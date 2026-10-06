import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { Pool } from "pg";
const credentials = JSON.parse(
  await fs.readFile(".local/database-credentials.json", "utf8"),
);
const pool = new Pool({
  connectionString: `postgresql://acuity_report:${credentials.report}@127.0.0.1:5433/acuitycompass`,
});
try {
  const model = JSON.parse(
    await fs.readFile("powerbi/AcuityCompass.SemanticModel/model.bim", "utf8"),
  ).model;
  const counts = {};
  for (const t of model.tables) {
    const m = t.partitions[0].source.expression.join("\n");
    const sql = m.match(/Query="([^"]+)"/)[1];
    const result = await pool.query(sql);
    counts[t.name] = result.rowCount;
    assert.deepEqual(
      result.fields.map((f) => f.name),
      t.columns.map((c) => c.name),
    );
  }
  for (const r of model.relationships) {
    assert(
      model.tables
        .find((t) => t.name === r.fromTable)
        .columns.some((c) => c.name === r.fromColumn),
    );
    assert(
      model.tables
        .find((t) => t.name === r.toTable)
        .columns.some((c) => c.name === r.toColumn),
    );
  }
  const latest = (
    await pool.query(
      "SELECT * FROM reporting.department_hourly ORDER BY snapshot_time DESC LIMIT 1",
    )
  ).rows[0];
  const total = (
    await pool.query(
      "SELECT sum(arrivals)::integer AS arrivals,sum(departures)::integer AS departures FROM reporting.department_hourly",
    )
  ).rows[0];
  assert.equal(total.arrivals, 3015);
  assert.equal(latest.active_patients, 9);
  assert.equal(latest.patients_waiting, 4);
  assert.equal(latest.occupied_beds, 6);
  assert.equal(latest.staffed_beds, 44);
  const areas = (
    await pool.query(
      "SELECT area_name,occupied,staffed_capacity FROM reporting.area_capacity_hourly WHERE snapshot_time=$1 AND is_bed_area=1 ORDER BY area_id",
      [latest.snapshot_time],
    )
  ).rows;
  const qa = {
    checkedAt: new Date().toISOString(),
    checks: [
      "19 PBIP/PBIR definition files pass Microsoft JSON schemas",
      "All five source queries execute with read-only reporting credentials",
      "Source columns and relationship references match the model",
      "Expected full-period KPIs match PostgreSQL",
    ],
    rowCounts: counts,
    expected: {
      ...total,
      active: 9,
      waiting: 4,
      occupancyPercent: (6 / 44) * 100,
      snapshotIST: "2026-09-28 00:00",
      areas,
    },
    notVerified: [
      "Power BI Desktop opening and rendering",
      "Power Query refresh in Desktop",
      "DAX execution in the Power BI engine",
    ],
  };
  await fs.writeFile(
    "powerbi/validation-results.json",
    JSON.stringify(qa, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      rows: counts,
      arrivals: total.arrivals,
      active: 9,
      waiting: 4,
      occupied: 6,
      staffed: 44,
    }),
  );
} finally {
  await pool.end();
}
