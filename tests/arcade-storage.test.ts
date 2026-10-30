// tests/arcade-storage.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveRaceRecordIfBest,
  getBestRecord,
  saveGhostTrajectory,
  getGhostTrajectory,
  tryUnlockAchievement,
  getUnlockedAchievements,
  GhostPoint
} from '../lib/arcade/storage';

// Mock Browser LocalStorage for Node.js test environment
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// 模拟 window.localStorage 环境
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = new MockLocalStorage();

test('Arcade Storage — 1. Best Race Record Persistence', () => {
  (globalThis as any).localStorage.clear();

  const record1 = {
    carId: 'v10-2004',
    time400m: 10.452,
    time0To100: 2.65,
    time0To200: 5.12,
    trapSpeedKmh: 310.5,
    reactionTimeMs: 240,
    perfectShiftCount: 3,
    date: '2026-10-31T01:00:00.000Z'
  };

  // 1. 首次成绩必然刷新纪录
  const isBest1 = saveRaceRecordIfBest(record1);
  assert.equal(isBest1, true);

  const saved1 = getBestRecord('v10-2004');
  assert.equal(saved1?.time400m, 10.452);

  // 2. 更慢的成绩 (10.999s) 不应覆盖已有最佳纪录
  const slowerRecord = {
    ...record1,
    time400m: 10.999
  };
  const isBestSlower = saveRaceRecordIfBest(slowerRecord);
  assert.equal(isBestSlower, false);

  const stillBest = getBestRecord('v10-2004');
  assert.equal(stillBest?.time400m, 10.452);

  // 3. 更快的成绩 (9.321s) 刷新纪录
  const fasterRecord = {
    ...record1,
    time400m: 9.321
  };
  const isBestFaster = saveRaceRecordIfBest(fasterRecord);
  assert.equal(isBestFaster, true);

  const newBest = getBestRecord('v10-2004');
  assert.equal(newBest?.time400m, 9.321);
});

test('Arcade Storage — 2. Ghost Telemetry Trajectory Sampling', () => {
  (globalThis as any).localStorage.clear();

  // 创建 500 个高频遥测轨迹点
  const heavyTrajectory: GhostPoint[] = [];
  for (let i = 0; i < 500; i++) {
    heavyTrajectory.push({
      timeMs: i * 20,
      distanceM: (i / 500) * 400,
      speedKmh: (i / 500) * 330,
      gear: Math.min(7, Math.floor(i / 70) + 1)
    });
  }

  saveGhostTrajectory('v10-2004', heavyTrajectory);

  const loaded = getGhostTrajectory('v10-2004');
  assert.ok(loaded);
  assert.ok(loaded.length > 0);
  // 必须被抽样压缩到 200 点以内以保护 LocalStorage
  assert.ok(loaded.length <= 200, `Trajectory must be compressed <= 200 points, got ${loaded.length}`);

  // 起点与终点必须被准确保留
  assert.equal(loaded[0].timeMs, 0);
  assert.equal(loaded[loaded.length - 1].timeMs, 499 * 20);
});

test('Arcade Storage — 3. Achievement Unlock State Machine', () => {
  (globalThis as any).localStorage.clear();

  // 初始成就为空
  assert.deepEqual(getUnlockedAchievements(), []);

  // 1. 首次解锁成就
  const res1 = tryUnlockAchievement('first_race');
  assert.ok(res1);
  assert.equal(res1.id, 'first_race');
  assert.equal(getUnlockedAchievements().includes('first_race'), true);

  // 2. 重复触发同个成就必须返回 null (幂等防御)
  const resDuplicate = tryUnlockAchievement('first_race');
  assert.equal(resDuplicate, null);

  // 3. 解锁另一个成就
  const res2 = tryUnlockAchievement('sub_10s');
  assert.ok(res2);
  assert.equal(res2.id, 'sub_10s');

  const all = getUnlockedAchievements();
  assert.equal(all.length, 2);
  assert.ok(all.includes('first_race'));
  assert.ok(all.includes('sub_10s'));
});
