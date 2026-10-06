import type { Pool } from "pg";
import { readDashboard } from "./dashboard.ts";

export async function saveFollowup(pool: Pool, body: Record<string, unknown>) {
  if (
    ["blocker", "owner", "status"].some((key) => typeof body[key] !== "string")
  )
    throw new Error("INVALID_ACTION");
  if (
    typeof body.snapshotTime !== "string" ||
    !Number.isFinite(Date.parse(body.snapshotTime)) ||
    typeof body.patientId !== "string" ||
    ![
      "Unknown",
      "Receiving team acceptance",
      "Bed preparation",
      "Transport",
      "Other",
    ].includes(String(body.blocker)) ||
    ![
      "Unassigned",
      "ED coordinator",
      "Receiving team",
      "Bed management",
      "Transport team",
    ].includes(String(body.owner)) ||
    !["Open", "In Progress", "Closed"].includes(String(body.status)) ||
    typeof body.note !== "string" ||
    !body.note.trim() ||
    body.note.trim().length > 500 ||
    !Number.isInteger(body.expectedId) ||
    Number(body.expectedId) < 0 ||
    (body.status !== "Open" && body.owner === "Unassigned")
  )
    throw new Error("INVALID_ACTION");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize updates for this record before reading the latest version.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      body.patientId,
    ]);
    const current = await readDashboard(client);
    if (
      !current.data ||
      current.data.updatedAt !== new Date(body.snapshotTime).toISOString()
    )
      throw new Error("STALE_SNAPSHOT");
    if (
      !current.data.patients.some(
        (p) => p.id === body.patientId && p.stage === "Awaiting Bed",
      )
    )
      throw new Error("INVALID_ACTION");
    const previous = current.data.followups?.find(
      (f) => f.patientId === body.patientId,
    );
    if ((previous?.id ?? 0) !== body.expectedId)
      throw new Error("FOLLOWUP_CONFLICT");
    await client.query(
      "INSERT INTO transfer_followups(snapshot_time,visit_id,blocker,owner,status,note) VALUES($1,$2,$3,$4,$5,$6)",
      [
        body.snapshotTime,
        body.patientId,
        body.blocker,
        body.owner,
        body.status,
        body.note.trim(),
      ],
    );
    const result = await readDashboard(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
