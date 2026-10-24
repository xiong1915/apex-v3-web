import type { ReplayDataset } from './types';
import { BAHRAIN_DEMO_METADATA, SILVERSTONE_DEMO_METADATA } from './demo-metadata';
export const DEMO_IDS = ['demo-singapore', 'demo-bahrain', 'demo-silverstone'];
export async function loadDemo(id: string): Promise<ReplayDataset> {
  if (id === 'demo-singapore') return { ...(await import('./sample-sessions')).DEFAULT_SINGAPORE_REPLAY, metadata: {...(await import('./sample-sessions')).DEFAULT_SINGAPORE_REPLAY.metadata, id, sourceProvider: 'curated_demo'} };
  if (id === 'demo-bahrain') return {metadata: BAHRAIN_DEMO_METADATA, frames: (await import('./real-sessions/bahrain-2023.json')).default as ReplayDataset['frames']};
  if (id === 'demo-silverstone') return {metadata: SILVERSTONE_DEMO_METADATA, frames: (await import('./real-sessions/silverstone-2023.json')).default as ReplayDataset['frames']};
  throw new Error('Unknown demonstration');
}
export const PENDING_METADATA = {...BAHRAIN_DEMO_METADATA, id:'pending', title:'正在加载真实回放', trackPath:[], corners:[], drsZones:[], sourceProvider:'openf1' as const};
