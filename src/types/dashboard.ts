export type TriageLevel =
  "Red" | "Orange" | "Yellow" | "Green" | "Blue" | "Not assessed";
export type PatientStage =
  | "Registration"
  | "Triage"
  | "Waiting"
  | "Assessment"
  | "Treatment"
  | "Awaiting Bed"
  | "Discharge";
export type Scenario = "normal" | "high" | "stale";
export type Tone = "normal" | "warning" | "critical" | "info";
export interface Patient {
  stageStartedAt?: string;
  stageMinutes?: number;
  timeline?: { label: string; at: string; description: string }[];
  id: string;
  arrivalTime: string;
  triageLevel: TriageLevel;
  stage: PatientStage;
  area: string;
  waitingMinutes: number;
  assignedBed?: string;
  lastUpdated: string;
  status: "Stable" | "Delayed" | "Priority";
}
export interface AreaCapacity {
  area: string;
  staffedCapacity: number;
  occupied: number;
  waiting: number;
  staffOnDuty: number | null;
}
export interface OperationalAlert {
  id: string;
  severity: "Critical" | "Warning" | "Information";
  title: string;
  explanation: string;
  trigger: string;
  affectedEntity: string;
  suggestedAction: string;
  createdAt: string;
  status: "Open" | "Acknowledged" | "Resolved";
}
export interface OperationalTask {
  id: string;
  description: string;
  relatedAlertId?: string;
  assignedRole: string;
  priority: "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Completed";
}
export interface HourlyFlow {
  hour: string;
  arrivals: number;
  departures: number;
}
export interface DashboardData {
  followups?: TransferFollowup[];
  scenario: Scenario;
  patients: Patient[];
  areas: AreaCapacity[];
  history: HourlyFlow[];
  alerts: OperationalAlert[];
  tasks: OperationalTask[];
  updatedAt: string;
}
export interface FollowupInput {
  patientId: string;
  blocker:
    | "Unknown"
    | "Receiving team acceptance"
    | "Bed preparation"
    | "Transport"
    | "Other";
  owner:
    | "Unassigned"
    | "ED coordinator"
    | "Receiving team"
    | "Bed management"
    | "Transport team";
  status: "Open" | "In Progress" | "Closed";
  note: string;
}
export interface TransferFollowup extends FollowupInput {
  id: number;
  recordedAt: string;
}
