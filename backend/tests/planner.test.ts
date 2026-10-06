import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../src/migrate.ts";
import { importDataset } from "../src/import-dataset.ts";
import { createApi } from "../src/app.ts";
test("planner API persists settings and outcomes, rejects stale choices and cross-origin writes", async () => {
  const secret = JSON.parse(
    await readFile(
      new URL("../../.local/database-credentials.json", import.meta.url),
      "utf8",
    ),
  );
  const admin = new Pool({
    connectionString: `postgresql://postgres:${secret.admin}@127.0.0.1:5433/postgres`,
  });
  const name = `acuity_planner_test_${Date.now()}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const pool = new Pool({
    connectionString: `postgresql://postgres:${secret.admin}@127.0.0.1:5433/${name}`,
  });
  const server = createApi(pool);
  try {
    await migrate(pool);
    await importDataset(pool);
    await migrate(pool);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const addr = server.address();
    assert(addr && typeof addr !== "string");
    const url = `http://127.0.0.1:${addr.port}/api/planner`;
    const post = (body: object, origin = "http://127.0.0.1:5173") =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(body),
      });
    const initial = await (await fetch(url)).json();
    assert(initial.forecast);
    assert.equal(initial.version, 0);
    const settings = initial.settings;
    settings.resources.forEach((r: any) => {
      r.staff = 5;
      r.minimumStaff = 1;
      r.reserveStaff = 1;
    });
    assert.equal(
      (
        await post(
          { kind: "settings", settings, version: 0 },
          "https://attacker.example",
        )
      ).status,
      403,
    );
    let response = await post({ kind: "settings", settings, version: 0 });
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.version, 1);
    assert.equal(
      (await post({ kind: "settings", settings, version: 0 })).status,
      409,
    );
    response = await post({ kind: "compare", version: 1 });
    assert.equal(response.status, 200);
    const compared = await response.json();
    const id = compared.runs[0].id;
    assert.equal(
      (
        await post({
          kind: "status",
          id,
          status: "started",
          selected: "transfer",
          confirmed: true,
          note: "",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post({
          kind: "status",
          id,
          status: "started",
          selected: "baseline",
          confirmed: true,
          note: "",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post({
          kind: "status",
          id,
          status: "started",
          selected: "baseline",
          confirmed: true,
          note: "",
        })
      ).status,
      409,
    );
    response = await post({
      kind: "status",
      id,
      status: "completed",
      note: "Test observation",
    });
    assert.equal(response.status, 200);
    const done = await response.json();
    assert.equal(done.runs[0].outcome.note, "Test observation");
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM reporting.planner_outcomes",
        )
      ).rows[0].n,
      1,
    );
    response = await post({ kind: "compare", version: 1 });
    const second = await response.json();
    await post({
      kind: "settings",
      settings: { ...settings, transferCount: 1 },
      version: 1,
    });
    assert.equal(
      (
        await post({
          kind: "status",
          id: second.runs[0].id,
          status: "started",
          selected: "baseline",
          confirmed: true,
          note: "",
        })
      ).status,
      409,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
