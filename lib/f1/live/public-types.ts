import type { F1Meeting, F1Session } from '../types';
import type { LivePhase, LiveSnapshot } from './types';
export type ResultStatus = 'unavailable' | 'provisional' | 'confirmed' | 'official';
export interface LiveResult {
 position: number; number: string | null; code: string; name: string; team: string;
 laps: number | null; time: string | null; q1?: string; q2?: string; q3?: string;
 status: string | null; points: number | null;
}
export interface PublicLiveMeetingSummary {
 round: number;
 name: string;
 nameZh: string;
 status: 'finished' | 'next' | 'upcoming';
}
export interface PublicLiveResponse {
 version: '3.3.0'; serverTime: string; season: string; meeting: F1Meeting | null;
 session: F1Session | null; nextSession: F1Session | null; nextMeeting?: F1Meeting | null;
 availableMeetings?: PublicLiveMeetingSummary[];
 latestFinishedMeeting?: { round: number; name: string; nameZh: string; session: string } | null;
 recapResults?: LiveResult[];
 calendarUpdatedAt: string | null; calendarSource: string; isStale: boolean;
 availability: {timingPublic: boolean; reason: string; source: string; officialUrl: string; channels: {name: string; status: string; note: string}[]};
 sessions: {session: F1Session; phase: LivePhase; classification: ResultStatus; reason: string}[];
 snapshot: LiveSnapshot | null; results: LiveResult[]; resultStatus: ResultStatus; resultSourceUrls: string[];
}
