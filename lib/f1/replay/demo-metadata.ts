import type { ReplaySessionMetadata } from './types';
import { BAHRAIN_TRACK_PATH, SILVERSTONE_TRACK_PATH } from './real-sessions/track-paths';
export const BAHRAIN_DEMO_METADATA: ReplaySessionMetadata = {
  id: 'demo-bahrain',
  title: '【DEMO 算法仿真】2023 赛季巴林大奖赛 演示',
  season: '2023',
  round: 1,
  meetingName: '巴林大奖赛 (演示)',
  locality: '萨基尔',
  circuitId: 'bahrain',
  circuitName: '巴林国际赛车场 (Bahrain International Circuit)',
  durationSeconds: 180,
  fps: 5,
  totalFrames: 900,
  trackPath: BAHRAIN_TRACK_PATH,
  corners: [
    { number: 1, name: 'T1 Heavy Braking', x: 0.18, y: 0.88 },
    { number: 4, name: 'T4 Downhill', x: 0.35, y: 0.32 },
    { number: 8, name: 'T8 Hairpin', x: 0.58, y: 0.65 },
    { number: 10, name: 'T10 Off-Camber', x: 0.38, y: 0.72 },
    { number: 14, name: 'T14 Final Turn', x: 0.78, y: 0.90 }
  ],
  drsZones: [
    { id: 'drs_1', startIndex: 0, endIndex: 15, name: '发车大直道 DRS 1' },
    { id: 'drs_2', startIndex: 35, endIndex: 50, name: '回传直道 DRS 2' }
  ],
  sourceProvider: 'curated_demo'
};

export const SILVERSTONE_DEMO_METADATA: ReplaySessionMetadata = {
  id: 'demo-silverstone',
  title: '【DEMO 算法仿真】2023 赛季英国大奖赛 (银石) 演示',
  season: '2023',
  round: 10,
  meetingName: '英国大奖赛 (演示)',
  locality: '银石',
  circuitId: 'silverstone',
  circuitName: '银石赛道 (Silverstone Circuit)',
  durationSeconds: 180,
  fps: 5,
  totalFrames: 900,
  trackPath: SILVERSTONE_TRACK_PATH,
  corners: [
    { number: 1, name: 'Abbey', x: 0.68, y: 0.82 },
    { number: 3, name: 'Village', x: 0.52, y: 0.74 },
    { number: 6, name: 'Brooklands', x: 0.28, y: 0.68 },
    { number: 9, name: 'Copse', x: 0.75, y: 0.45 },
    { number: 11, name: 'Maggotts', x: 0.70, y: 0.32 },
    { number: 12, name: 'Becketts', x: 0.62, y: 0.28 },
    { number: 15, name: 'Stowe', x: 0.32, y: 0.25 },
    { number: 16, name: 'Vale', x: 0.42, y: 0.55 }
  ],
  drsZones: [
    { id: 'drs_1', startIndex: 15, endIndex: 35, name: '威灵顿直道 DRS 1' },
    { id: 'drs_2', startIndex: 80, endIndex: 105, name: '机库直道 DRS 2' }
  ],
  sourceProvider: 'curated_demo'
};

