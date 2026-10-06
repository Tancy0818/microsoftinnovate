import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
const tables = [
  "areas",
  "dates",
  "visits",
  "flow_events",
  "department_hourly",
  "area_capacity_hourly",
] as const;
export async function importDataset(
  pool: Pool,
  path = new URL("../../dataset/dataset.json", import.meta.url),
) {
  const raw = await readFile(path, "utf8");
  const data = JSON.parse(raw) as Record<string, Record<string, unknown>[]>;
  const id = createHash("sha256").update(raw).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7234091)");
    // CSV/JSON timestamps are explicitly Asia/Kolkata wall-clock timestamps.
    await client.query("SET LOCAL TIME ZONE 'Asia/Kolkata'");
    if (
      (await client.query("SELECT 1 FROM dataset_imports WHERE id=$1", [id]))
        .rowCount
    ) {
      await client.query("COMMIT");
      return "Already imported; no changes.";
    }
    if (
      (await client.query("SELECT 1 FROM department_hourly LIMIT 1")).rowCount
    )
      throw new Error(
        "Database already contains a different dataset. Import into a separate database; existing data will not be overwritten.",
      );
    for (const table of tables) {
      if (!Array.isArray(data[table]) || !data[table].length)
        throw new Error(`Missing dataset table: ${table}`);
      const records = data[table].map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, v === "" ? null : v]),
        ),
      );
      for (let i = 0; i < records.length; i += 1000)
        await client.query(
          `INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb)`,
          [JSON.stringify(records.slice(i, i + 1000))],
        );
    }
    const check = await client.query(`SELECT
   (SELECT count(*)::integer FROM reporting.latest_patients) AS queue,
   (SELECT active_patients FROM department_hourly ORDER BY snapshot_time DESC LIMIT 1) AS census,
   (SELECT count(*) FROM (SELECT visit_id FROM reporting.latest_patients GROUP BY visit_id HAVING count(*)>1) d)::integer AS duplicates`);
    if (
      check.rows[0].queue !== check.rows[0].census ||
      check.rows[0].duplicates
    )
      throw new Error(
        "Import failed: latest queue does not reconcile with census.",
      );
    await client.query(
      "INSERT INTO dataset_imports(id,source_label,snapshot_time,synthetic) SELECT $1,'30-day synthetic ED activity',max(snapshot_time),true FROM department_hourly",
      [id],
    );
    await client.query("SELECT seed_operational_patients()");
    await client.query("COMMIT");
    return "Synthetic dataset imported successfully.";
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
