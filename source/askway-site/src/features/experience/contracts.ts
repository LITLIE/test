export type FactStatus = 'verified' | 'reference' | 'estimate' | 'unknown';
export interface Fact<T> {
  value: T | null;
  status: FactStatus;
  sourceId: string;
  checkedAt: string | null;
  note?: string;
}
export interface Source {
  id: string;
  title: string;
  url: string;
  license: string;
  accessedAt: string;
}
export interface Place {
  id: string;
  name: string;
  category: 'coast' | 'culture' | 'park';
  description: string;
  /** WGS84, GeoJSON order: [longitude, latitude]. Reference location, not an entrance. */
  coordinates: Fact<[number, number]>;
  coordinateSystem: 'WGS84';
  pointKind: 'reference';
  entranceVerified: false;
  visitMode: 'exterior';
  stayMinutes: Fact<number>;
  opening: Fact<string>;
  fee: Fact<number>;
  accessibility: Fact<string>;
  sourceIds: string[];
  image?: string;
}
export interface Catalog {
  version: string;
  asOf: string;
  city: string;
  timeZone: string;
  originPlaceId: string;
  places: Place[];
  sources: Source[];
  policy: {
    startBufferMinutes: number;
    endBufferMinutes: number;
    walkingMetersPerMinute: number;
    roadFactor: number;
    mixedMetersPerMinute: number;
    transferMinutes: number;
  };
}
export type Pace = 'relaxed' | 'balanced' | 'compact';
export type Transport = 'walk' | 'mixed';
export interface ConditionsDraft {
  date: string;
  startTime: string;
  timeLimitMinutes: number;
  pace: Pace;
  transport: Transport;
  mandatoryPlaceIds: string[];
  excludedPlaceIds: string[];
  scenario: 'none' | 'less-walking';
  originPlaceId: string;
}
export interface ConditionIssue {
  code: string;
  message: string;
  field?: string;
  placeIds?: string[];
  suggestion?: string;
}
export interface PlanCheck {
  key: string;
  label: string;
  status: 'satisfied' | 'estimate' | 'unknown';
  detail: string;
}
export interface PlanLeg {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  transport: Transport;
  distanceKm: Fact<number>;
  durationMinutes: Fact<number>;
  walkingKm: number;
  geometry: { kind: 'schematic'; coordinates: [number, number][] };
}
export interface PlanStop {
  placeId: string;
  arrivalMinutes: number;
  departureMinutes: number;
  stayMinutes: number;
}
export interface ConfirmedPlan {
  id: string;
  versionNo: number;
  catalogVersion: string;
  conditions: ConditionsDraft;
  orderedPlaceIds: string[];
  legs: PlanLeg[];
  stops: PlanStop[];
  totals: {
    travelMinutes: number;
    stayMinutes: number;
    bufferMinutes: number;
    totalMinutes: number;
    remainingMinutes: number;
    knownFee: number;
    hasUnknownFee: boolean;
    distanceKm: number;
    walkingKm: number;
  };
  checks: PlanCheck[];
  explanations: string[];
  createdAtMs: number;
}
export interface PlanDelta {
  addedPlaceIds: string[];
  removedPlaceIds: string[];
  orderChanged: boolean;
  minutesChange: number;
  walkingKmChange: number;
  bufferMinutesChange: number;
  feeChange: number | null;
  summary: string[];
}
export interface RequestScope {
  requestId: string;
  sessionEpoch: number;
  draftRevision: number;
  operation: 'propose';
}
export interface Proposal {
  id: string;
  baseVersionNo: number;
  draftRevision: number;
  sessionEpoch: number;
  requestId: string;
  expiresAtMs: number;
  candidate: ConfirmedPlan;
  delta: PlanDelta | null;
}
export type ProposalResult =
  | { kind: 'proposal'; proposal: Proposal }
  | { kind: 'conflict' | 'clarification'; issues: ConditionIssue[] };
export interface ExperienceState {
  sessionEpoch: number;
  draftRevision: number;
  versionCounter: number;
  draft: ConditionsDraft;
  confirmedRevision: number | null;
  activePlan: ConfirmedPlan | null;
  previousPlan: ConfirmedPlan | null;
  proposal: Proposal | null;
  pending: RequestScope | null;
  issues: ConditionIssue[];
  status: 'editing' | 'reviewed' | 'planning' | 'proposal' | 'confirmed' | 'conflict' | 'failed';
  selectedPlaceId: string | null;
  view: '2d' | '3d';
  message: string | null;
}
export type ExperienceAction =
  | { type: 'DRAFT_CHANGED'; draft: ConditionsDraft }
  | { type: 'CONDITIONS_CONFIRMED' }
  | { type: 'REQUEST_STARTED'; scope: RequestScope }
  | { type: 'PROPOSAL_READY'; scope: RequestScope; result: ProposalResult }
  | { type: 'REQUEST_FAILED'; scope: RequestScope; message: string }
  | { type: 'ADOPT'; nowMs: number }
  | { type: 'UNDO' }
  | { type: 'SELECT_PLACE'; placeId: string | null }
  | { type: 'SET_VIEW'; view: '2d' | '3d' }
  | { type: 'RESET'; draft: ConditionsDraft }
  | { type: 'CANCEL' };
export interface SceneProps {
  catalog: Catalog;
  plan: ConfirmedPlan | null;
  previousPlan?: ConfirmedPlan | null;
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
  reducedMotion: boolean;
  playbackIndex?: number | null;
  scenePreset?: 'overview' | 'theatre' | 'route';
  lighting?: 'day' | 'dusk';
  presentation?: 'workbench' | 'cinematic';
  animationEnabled?: boolean;
  onAnimationChange?: (enabled: boolean) => void;
}
