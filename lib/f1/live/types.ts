export type LivePhase = 'UPCOMING' | 'WAITING' | 'LIVE' | 'SUSPENDED' | 'FINISHED' | 'DELAYED' | 'CANCELLED';
export type LiveConnection = 'LIVE' | 'DELAYED' | 'RECONNECTING' | 'UNAVAILABLE' | 'FINISHED';
export const LIVE_TOPICS = ['TimingData', 'TimingStats', 'TimingAppData', 'DriverList', 'SessionInfo', 'SessionData', 'TrackStatus', 'RaceControlMessages', 'LapCount', 'WeatherData'] as const;
export type LiveTopic = typeof LIVE_TOPICS[number];
export interface LiveDriver {
  number: string; code: string; name: string; team: string; teamColour: string | null;
  position: number | null; lastLap: string | null; bestLap: string | null; sectors: (string | null)[];
  completedLaps: number | null; gapLeader: string | null; gapAhead: string | null;
  compound: string | null; tyreAge: number | null; pitCount: number | null;
  inPit: boolean | null; retired: boolean | null; updatedAt: string | null;
  sourceTimestamps?: Partial<Record<LiveTopic, string | null>>;
  sectorPersonalBest?: boolean[]; sectorOverallBest?: boolean[];
}
export interface LiveSnapshot {
  sessionType?: string | null;
  lifecycleTimestamp?: string | null;
  lifecycleStatus?: string | null;
  topicTimestamps?: Partial<Record<LiveTopic, string | null>>;
  schema: 1; sessionKey: string; phase: LivePhase; connection: LiveConnection; source: string;
  sourceTimestamp: string | null; receivedAt: string | null; drivers: LiveDriver[];
  flag: string | null; messages: {id: string; date: string; text: string}[];
  weather: {airTemperature: number | null; trackTemperature: number | null; rainfall: boolean | null} | null;
  currentLap: number | null; totalLaps: number | null; segment: string | null; remainingSeconds: number | null;
  classification: 'unavailable' | 'provisional' | 'official'; reason: string | null;
  /** Timing-session closure, distinct from an individual Q/SQ segment ending and from official classification. */
  sessionFinalized?: boolean;
}
export interface LiveEvent {
  topic: LiveTopic; payload: Record<string, unknown>; sessionKey: string;
  timestamp: string | null; receivedAt: string; id?: string; initial?: boolean;
}
/** A transport grant is evidence supplied by the operator, never a claim inferred from an open endpoint. */
export interface LivePermission {
  publicRedistribution: boolean; reference: string; expiresAt: string;
  topics: readonly LiveTopic[];
}
