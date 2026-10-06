import { createPool } from "./db.ts";
import { migrate } from "./migrate.ts";
import { importDataset } from "./import-dataset.ts";
const pool = createPool();
try {
  if (process.argv[2] === "migrate") {
    await migrate(pool);
    console.log("Database schema ready.");
  } else if (process.argv[2] === "import")
    console.log(await importDataset(pool));
  else throw new Error("Use migrate or import.");
} catch (e) {
  console.error(e instanceof Error ? e.message : "Database command failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
