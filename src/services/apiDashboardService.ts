import type { DashboardData, FollowupInput } from "../types/dashboard";
export interface ApiDashboard {
  state: "empty" | "ready";
  data: DashboardData | null;
  synthetic: boolean;
  source: "postgresql";
}
async function request(
  path: string,
  options?: RequestInit,
): Promise<ApiDashboard> {
  const response = await fetch(path, {
    ...options,
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    throw new Error(
      "Backend is unreachable. Start the local services and retry.",
    );
  });
  const result = await response.json().catch(() => {
    throw new Error(
      "Backend returned an invalid response. Check the API server.",
    );
  });
  if (!response.ok)
    throw new Error(result.error || "Unable to load database records.");
  if (!["ready", "empty"].includes(result.state))
    throw new Error("Invalid dashboard response.");
  return result;
}
export const getDatabaseDashboard = () => request("/api/dashboard");
export const saveDatabaseFollowup = (
  body: FollowupInput & { snapshotTime: string; expectedId: number },
) =>
  request("/api/followups", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
export const saveDatabaseAction = (body: {
  snapshotTime: string;
  alertId: string;
  kind: "acknowledge" | "task";
  status?: string;
}) =>
  request("/api/actions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
