import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Pool } from "pg";
import { getDashboard, saveAction } from "./dashboard.ts";
import { saveFollowup } from "./followups.ts";
import { getInteractive, writeInteractive } from "./interactive.ts";
import { getPlanner, writePlanner } from "./planning.ts";
function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}
async function json(req: IncomingMessage) {
  let text = "";
  for await (const part of req) {
    text += part;
    if (Buffer.byteLength(text) > 8192) throw new Error("INVALID_ACTION");
  }
  try {
    const body = JSON.parse(text);
    if (!body || Array.isArray(body) || typeof body !== "object")
      throw new Error();
    return body;
  } catch {
    throw new Error("INVALID_ACTION");
  }
}
export function createApi(pool: Pool) {
  return createServer(async (req, res) => {
    const path = req.url?.split("?")[0];
    try {
      if (req.method === "GET" && path === "/api/health") {
        await pool.query("SELECT 1");
        return send(res, 200, { status: "ok", database: "connected" });
      }
      if (req.method === "GET" && path === "/api/dashboard")
        return send(res, 200, await getDashboard(pool));
      if (req.method === "GET" && path === "/api/interactive")
        return send(res, 200, await getInteractive(pool));
      if (req.method === "GET" && path === "/api/planner")
        return send(res, 200, await getPlanner(pool));
      if (
        (req.method === "PATCH" &&
          (path === "/api/actions" || path === "/api/followups")) ||
        (req.method === "POST" &&
          (path === "/api/interactive" || path === "/api/planner"))
      ) {
        // No cross-origin writes; the Vite proxy is the browser's same-origin API.
        const origin = req.headers.origin;
        if (
          origin &&
          !["http://127.0.0.1:5173", "http://localhost:5173"].includes(origin)
        )
          return send(res, 403, { error: "Origin not allowed." });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return send(res, 415, { error: "JSON body required." });
        if (path === "/api/interactive")
          return send(res, 200, await writeInteractive(pool, await json(req)));
        if (path === "/api/planner")
          return send(res, 200, await writePlanner(pool, await json(req)));
        return send(
          res,
          200,
          await (path === "/api/followups" ? saveFollowup : saveAction)(
            pool,
            await json(req),
          ),
        );
      }
      send(res, 404, { error: "Endpoint not found." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message === "INVALID_PLANNER")
        return send(res, 400, {
          error:
            "Check resource values, action and confirmation. Use whole numbers within the displayed limits.",
        });
      if (message === "PLANNER_CONFLICT")
        return send(res, 409, {
          error:
            "Records or assumptions changed, or this comparison expired. Refresh and compare again before recording an action.",
        });
      if (message === "FORECAST_UNAVAILABLE")
        return send(res, 422, {
          error:
            "At least 14 complete, consecutive days of hourly demand are required.",
        });
      if (message === "INVALID_PATIENT")
        return send(res, 400, {
          error:
            "Check the patient fields, stage transition, triage and bed. Arrival must be within the last 30 days and cannot be in the future.",
        });
      if (message === "PATIENT_CONFLICT")
        return send(res, 409, {
          error: "This patient changed. Refresh before updating.",
        });
      if (message === "BED_OCCUPIED")
        return send(res, 409, {
          error:
            "That bed is occupied. Select an available bed or leave the patient unassigned.",
        });
      if (message === "INVALID_ACTION")
        return send(res, 400, { error: "Invalid action." });
      if (message === "FOLLOWUP_CONFLICT")
        return send(res, 409, {
          error:
            "This follow-up changed in another session. Refresh before saving.",
        });
      if (message === "STALE_SNAPSHOT")
        return send(res, 409, {
          error: "The snapshot changed. Refresh before saving.",
        });
      console.error(
        "API operation failed:",
        e instanceof Error ? e.name : "DatabaseError",
      );
      send(res, 503, {
        error:
          "Database unavailable. Check the local database and run migrations, then retry.",
      });
    }
  });
}
