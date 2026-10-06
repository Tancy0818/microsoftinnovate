import type { DashboardData, Scenario } from "../types/dashboard.ts";
export interface DashboardDataProvider {
  getDashboard(scenario: Scenario): Promise<DashboardData>;
}
