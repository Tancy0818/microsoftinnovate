import type {
  DashboardData,
  Patient,
  PatientStage,
} from "../types/dashboard.ts";
import {
  currentStageStart,
  isDeparted,
  type InteractiveData,
} from "../types/interactive.ts";
import { generateAlerts } from "./alertRules.ts";

export function interactiveDashboard(input: InteractiveData): DashboardData {
  const now = Date.parse(input.asOf);
  const patients: Patient[] = input.visits
    .filter((v) => !isDeparted(v.events[0].stage))
    .map((v) => {
      const e = v.events[0];
      return {
        id: v.id,
        arrivalTime: v.arrivalTime,
        triageLevel: e.triage,
        stage: e.stage as PatientStage,
        area: e.area,
        waitingMinutes: Math.max(
          0,
          Math.floor((now - Date.parse(v.arrivalTime)) / 60000),
        ),
        stageStartedAt: currentStageStart(v),
        stageMinutes: Math.max(
          0,
          Math.floor((now - Date.parse(currentStageStart(v))) / 60000),
        ),
        assignedBed: e.bed ? `${e.area} / ${e.bed}` : undefined,
        lastUpdated: input.asOf,
        status: ["Red", "Orange"].includes(e.triage) ? "Priority" : "Stable",
        timeline: [...v.events]
          .reverse()
          .map((event) => ({
            label: event.stage,
            at: event.occurredAt,
            description: `${event.area} · ${event.triage}${event.bed ? ` · Bed ${event.bed}` : ""}`,
          })),
      };
    });
  const areas = input.areas.map((a) => ({
    area: a.name,
    staffedCapacity: a.capacity,
    occupied: a.occupied,
    waiting: patients.filter(
      (p) =>
        p.area === a.name &&
        ["Registration", "Triage", "Waiting", "Awaiting Bed"].includes(p.stage),
    ).length,
    staffOnDuty: null,
  }));
  const offset = 330 * 60000;
  const hour = Math.floor((now + offset) / 3600000) * 3600000 - offset;
  const history = Array.from({ length: 12 }, (_, i) => {
    const start = hour - (11 - i) * 3600000,
      end = start + 3600000;
    return {
      hour: new Date(start).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        hour12: false,
      }),
      arrivals: input.visits.filter(
        (v) =>
          Date.parse(v.arrivalTime) >= start && Date.parse(v.arrivalTime) < end,
      ).length,
      departures: input.visits.filter((v) => {
        const e = v.events[0];
        return (
          isDeparted(e.stage) &&
          Date.parse(e.occurredAt) >= start &&
          Date.parse(e.occurredAt) < end
        );
      }).length,
    };
  });
  const base = {
    patients,
    areas,
    history,
    updatedAt: input.asOf,
    scenario: "normal" as const,
  };
  return {
    ...base,
    alerts: generateAlerts(base, { historical: true }),
    tasks: [],
  };
}
