export interface ResourceInput {
  areaId: string;
  readyBeds: number;
  staff: number;
  bedsPerStaff: number;
  serviceMinutes: number;
  reserveStaff: number;
  minimumStaff: number;
}
export interface PlannerSettings {
  resources: ResourceInput[];
  targetArea: string;
  donorArea: string;
  wardReady: "unknown" | "yes" | "no";
  transferCount: number;
  verifiedAt: string;
}
export interface ForecastPoint {
  time: string;
  expected: number;
  lower: number;
  upper: number;
}
export interface Forecast {
  model: string;
  trainedFrom: string;
  trainedThrough: string;
  hours: number;
  validationMae: number;
  baselineMae: number;
  testMae: number;
  testBaselineMae: number;
  coverage: number;
  testHours: number;
  points: ForecastPoint[];
  stale: boolean;
}
export interface PlanOption {
  id: string;
  title: string;
  feasible: boolean;
  reason: string;
  queue: number;
  lower: number;
  upper: number;
  donorPenalty: number;
}
export interface PlanResult {
  options: PlanOption[];
  recommendation: string | null;
  verification: string[];
  capacity: {
    areaId: string;
    name: string;
    physical: number;
    usable: number;
    occupied: number;
    constraint: string;
  }[];
  startingQueue: number;
  active: number;
  expectedArrivals: number;
  assumptions: string[];
}
export interface PlanRun {
  id: string;
  created_at: string;
  status: "compared" | "started" | "completed" | "cancelled";
  selected: string | null;
  started_at: string | null;
  completed_at: string | null;
  result: PlanResult;
  settings: PlannerSettings;
  outcome: {
    active: number;
    queue: number;
    observedAt: string;
    elapsedMinutes: number;
    note: string;
  } | null;
}
