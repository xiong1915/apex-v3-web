// lib/arcade/storage.ts
// APEX V3 Acoustic Rev Arcade — Local Persistence & Ghost Telemetry

export interface RaceRecord {
  carId: string;
  time400m: number;
  time0To100: number | null;
  time0To200: number | null;
  trapSpeedKmh: number;
  reactionTimeMs: number;
  perfectShiftCount: number;
  date: string;
}

export interface GhostPoint {
  timeMs: number;
  distanceM: number;
  speedKmh: number;
  gear: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_race',
    title: '格子旗初体验',
    description: '完成第一场 400 米直线加速赛',
    icon: '🏁'
  },
  {
    id: 'sub_10s',
    title: '进入 9 秒俱乐部',
    description: '以低于 10.0 秒的优异成绩冲破 400 米终点',
    icon: '⚡'
  },
  {
    id: 'perfect_launcher',
    title: '弹射大师',
    description: '在发车灯熄灭后 200ms 以内以 PERFECT 状态起步',
    icon: '🎯'
  },
  {
    id: 'gearbox_god',
    title: '无缝换挡神级操作',
    description: '单场比赛中完成至少 4 次 PERFECT SHIFT 完美换挡',
    icon: '⚙️'
  },
  {
    id: 'engine_guru',
    title: '声浪鉴赏大师',
    description: '在听声辨引擎测试中取得 10 题满分',
    icon: '👑'
  }
];

const STORAGE_KEYS = {
  BEST_RECORDS: 'apex_rev_arcade_records_v2',
  GHOSTS: 'apex_rev_arcade_ghosts_v2',
  ACHIEVEMENTS: 'apex_rev_arcade_achievements_v2'
};

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * 获取指定车型的最佳成绩
 */
export function getBestRecord(carId: string): RaceRecord | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BEST_RECORDS);
    if (!raw) return null;
    const records = JSON.parse(raw);
    return records[carId] || null;
  } catch {
    return null;
  }
}

/**
 * 尝试保存新成绩。如果刷新纪录则持久化并返回 true
 */
export function saveRaceRecordIfBest(record: RaceRecord): boolean {
  if (!isClient()) return false;
  try {
    const currentBest = getBestRecord(record.carId);
    let isBetter = false;

    if (!currentBest || record.time400m < currentBest.time400m) {
      isBetter = true;
    }

    if (isBetter) {
      const raw = localStorage.getItem(STORAGE_KEYS.BEST_RECORDS);
      const records = raw ? JSON.parse(raw) : {};
      records[record.carId] = record;
      localStorage.setItem(STORAGE_KEYS.BEST_RECORDS, JSON.stringify(records));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 读取幽灵车遥测轨迹
 */
export function getGhostTrajectory(carId: string): GhostPoint[] | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GHOSTS);
    if (!raw) return null;
    const ghosts = JSON.parse(raw);
    const data = ghosts[carId];
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

/**
 * 保存幽灵车轨迹 (限制最多 250 个关键插值点以防 LocalStorage 膨胀)
 */
export function saveGhostTrajectory(carId: string, trajectory: GhostPoint[]): void {
  if (!isClient() || !trajectory || trajectory.length === 0) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GHOSTS);
    const ghosts = raw ? JSON.parse(raw) : {};

    // 抽样压缩至最多 200 点
    let sampled = trajectory;
    if (trajectory.length > 200) {
      const step = Math.ceil(trajectory.length / 200);
      sampled = trajectory.filter((_, idx) => idx % step === 0 || idx === trajectory.length - 1);
    }

    ghosts[carId] = sampled;
    localStorage.setItem(STORAGE_KEYS.GHOSTS, JSON.stringify(ghosts));
  } catch {
    // 忽略存储超限异常
  }
}

/**
 * 读取已解锁的成就 ID 列表
 */
export function getUnlockedAchievements(): string[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * 尝试解锁成就，若为首次解锁返回对应成就对象，否则返回 null
 */
export function tryUnlockAchievement(achievementId: string): AchievementDef | null {
  if (!isClient()) return null;
  try {
    const unlocked = getUnlockedAchievements();
    if (unlocked.includes(achievementId)) return null;

    const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!def) return null;

    unlocked.push(achievementId);
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(unlocked));
    return def;
  } catch {
    return null;
  }
}
