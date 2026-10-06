import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  writeFile,
  readFile,
  unlink,
  appendFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
const root = fileURLToPath(new URL("../", import.meta.url));
const local = path.join(root, ".local");
const bin = path.join(local, "pgsql", "bin");
function run(name, args) {
  const result = spawnSync(path.join(bin, name + ".exe"), args, {
    windowsHide: true,
    stdio: "ignore",
  });
  if (result.status !== 0)
    throw new Error(`Cannot run ${name}; inspect .local/logs/postgres.log.`);
}
await mkdir(path.join(local, "logs"), { recursive: true });
const credentials = path.join(local, "database-credentials.json");
if (!existsSync(credentials))
  await writeFile(
    credentials,
    JSON.stringify({
      admin: randomBytes(24).toString("hex"),
      app: randomBytes(24).toString("hex"),
    }),
  );
const secret = JSON.parse(await readFile(credentials, "utf8"));
if (!secret.report) {
  secret.report = randomBytes(24).toString("hex");
  await writeFile(credentials, JSON.stringify(secret));
}
const data = path.join(local, "pgdata");
if (!existsSync(path.join(data, "PG_VERSION"))) {
  const passwordFile = path.join(local, "init-password");
  await writeFile(passwordFile, secret.admin);
  try {
    run("initdb", [
      "-D",
      data,
      "-U",
      "postgres",
      "--pwfile=" + passwordFile,
      "--auth=scram-sha-256",
      "--encoding=UTF8",
      "--locale=C",
    ]);
  } finally {
    await unlink(passwordFile);
  }
  await appendFile(
    path.join(data, "postgresql.conf"),
    "\nlisten_addresses = '127.0.0.1'\nport = 5433\ntimezone = 'Asia/Kolkata'\n",
  );
}
const status = spawnSync(path.join(bin, "pg_ctl.exe"), ["-D", data, "status"], {
  windowsHide: true,
});
if (status.status !== 0)
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(local, "logs", "postgres.log"),
    "-w",
    "start",
  ]);
const pool = new Pool({
  connectionString: `postgresql://postgres:${secret.admin}@127.0.0.1:5433/postgres`,
});
try {
  if (
    !(await pool.query("SELECT 1 FROM pg_roles WHERE rolname='acuity_app'"))
      .rowCount
  )
    await pool.query(
      `CREATE ROLE acuity_app LOGIN PASSWORD '${secret.app}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
    );
  if (
    !(
      await pool.query(
        "SELECT 1 FROM pg_database WHERE datname='acuitycompass'",
      )
    ).rowCount
  )
    await pool.query("CREATE DATABASE acuitycompass OWNER acuity_app");
  if (
    !(await pool.query("SELECT 1 FROM pg_roles WHERE rolname='acuity_report'"))
      .rowCount
  )
    await pool.query(
      `CREATE ROLE acuity_report LOGIN PASSWORD '${secret.report}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
    );
  if (!existsSync(path.join(root, ".env")))
    await writeFile(
      path.join(root, ".env"),
      `DATABASE_URL=postgresql://acuity_app:${secret.app}@127.0.0.1:5433/acuitycompass\nAPI_PORT=3001\n`,
    );
  console.log(
    "Local PostgreSQL ready on 127.0.0.1:5433. Credentials saved locally; no system service installed.",
  );
} finally {
  await pool.end();
}
