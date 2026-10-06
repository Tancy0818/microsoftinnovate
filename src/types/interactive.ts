export const interactiveStages = [
  "Registration",
  "Triage",
  "Waiting",
  "Assessment",
  "Treatment",
  "Awaiting Bed",
  "Discharge",
  "Departed",
  "Discharged",
  "Transferred",
  "Admitted",
  "Left before completion",
] as const;
export const interactiveTriages = [
  "Not assessed",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
] as const;
export type InteractiveStage = (typeof interactiveStages)[number];
export type InteractiveTriage = (typeof interactiveTriages)[number];
export interface InteractiveEvent {
  id: number;
  occurredAt: string;
  recordedAt: string;
  stage: InteractiveStage;
  triage: InteractiveTriage;
  areaId: string;
  area: string;
  bed: number | null;
  destination?: string | null;
}
export interface InteractiveVisit {
  id: string;
  arrivalTime: string;
  arrivalMethod: string;
  events: InteractiveEvent[];
}
export interface InteractiveData {
  asOf: string;
  visits: InteractiveVisit[];
  areas: {
    id: string;
    name: string;
    capacity: number;
    bedArea: boolean;
    occupied: number;
  }[];
}
export const isDeparted = (stage: InteractiveStage) =>
  ["Departed", "Discharged", "Transferred", "Admitted", "Left before completion"].includes(
    stage,
  );
export function currentStageStart(visit: InteractiveVisit) {
  const stage = visit.events[0].stage;
  let started = visit.events[0].occurredAt;
  for (const event of visit.events) {
    if (event.stage !== stage) break;
    started = event.occurredAt;
  }
  return started;
}
export const nextStages: Record<InteractiveStage, readonly InteractiveStage[]> =
  {
    Registration: [
      "Registration",
      "Triage",
      "Discharged",
      "Transferred",
      "Left before completion",
    ],
    Triage: [
      "Triage",
      "Waiting",
      "Assessment",
      "Discharged",
      "Transferred",
      "Left before completion",
    ],
    Waiting: [
      "Waiting",
      "Assessment",
      "Discharged",
      "Transferred",
      "Left before completion",
    ],
    Assessment: [
      "Assessment",
      "Treatment",
      "Awaiting Bed",
      "Discharged",
      "Transferred",
      "Left before completion",
    ],
    Treatment: [
      "Treatment",
      "Awaiting Bed",
      "Discharged",
      "Transferred",
      "Left before completion",
    ],
    "Awaiting Bed": [
      "Awaiting Bed",
      "Treatment",
      "Admitted",
      "Discharged",
      "Transferred",
      "Left before completion",
    ],
    Discharge: ["Discharge", "Discharged", "Transferred", "Left before completion"],
    Departed: [],
    Discharged: [],
    Transferred: [],
    Admitted: [],
    "Left before completion": [],
  };
