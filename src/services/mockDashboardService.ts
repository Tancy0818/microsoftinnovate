import type { DashboardDataProvider } from "./dashboardDataProvider.ts";
import { createScenario } from "../data/scenarios.ts";
export const dashboardProvider: DashboardDataProvider = {
  async getDashboard(scenario) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (new URLSearchParams(window.location.search).get("mockError") === "1")
      throw new Error(
        "The synthetic event feed could not be reached. Remove ?mockError=1 from the URL, then retry.",
      );
    return createScenario(scenario);
  },
};
