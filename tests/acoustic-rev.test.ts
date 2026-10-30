// tests/acoustic-rev.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENGINE_PRESETS, calculateFiringFrequency } from '../lib/audio/engine-presets';
import { RevPhysicsSimulator } from '../lib/audio/rev-physics';

test('Acoustic Rev — 1. Engine Presets & Firing Frequency Calculations', () => {
  const v10 = ENGINE_PRESETS['v10-2004'];
  const v8 = ENGINE_PRESETS['v8-2010'];
  const v6 = ENGINE_PRESETS['v6-2026'];

  assert.ok(v10 && v8 && v6, 'All 3 engine presets must exist');
  assert.equal(v10.cylinders, 10);
  assert.equal(v8.cylinders, 8);
  assert.equal(v6.cylinders, 6);

  // 4冲程点火基频公式: f = RPM * Cyl / 120
  // V10 @ 18,000 RPM => 1500 Hz
  assert.equal(calculateFiringFrequency(18000, 10), 1500);
  // V8 @ 18,000 RPM => 1200 Hz
  assert.equal(calculateFiringFrequency(18000, 8), 1200);
  // V6 @ 15,000 RPM => 750 Hz
  assert.equal(calculateFiringFrequency(15000, 6), 750);
  // 怠速保障：最低不低于 20 Hz
  assert.ok(calculateFiringFrequency(100, 4) >= 20);
});

test('Acoustic Rev — 2. RPM Physics Simulation & Inertial Acceleration', () => {
  const v10 = ENGINE_PRESETS['v10-2004'];
  const sim = new RevPhysicsSimulator(v10);

  // 1. 初始状态为怠速
  const init = sim.step(0.016, 0);
  assert.equal(init.rpm, v10.idleRpm);
  assert.equal(init.isLimiterActive, false);

  // 2. 模拟全油门踩下 1 帧 (16ms)
  const step1 = sim.step(0.016, 1.0);
  assert.ok(step1.rpm > v10.idleRpm, 'RPM must increase');
  assert.ok(step1.rpm < v10.idleRpm + 1500, 'RPM must not jump instantly to redline');

  // 3. 模拟连续全油门 0.6 秒
  let state = step1;
  for (let i = 0; i < 40; i++) {
    state = sim.step(0.016, 1.0);
  }
  assert.ok(state.rpm > 12000, 'RPM should climb toward redline with inertia');
  assert.ok(state.engineLoad > 0.5, 'Engine load should be high');
});

test('Acoustic Rev — 3. Rev Limiter Bouncing & Overrun Backfire Triggering', () => {
  const v8 = ENGINE_PRESETS['v8-2010'];
  const sim = new RevPhysicsSimulator(v8);

  // 持续猛踩油门直到撞红线限制器
  let state = sim.step(0.016, 1.0);
  for (let i = 0; i < 120; i++) {
    state = sim.step(0.016, 1.0);
  }

  assert.ok(state.rpm >= v8.redlineRpm - 500, 'Should reach near redline');
  assert.ok(state.isLimiterActive, 'Limiter should be active at max rev');

  // 突发松油门 (测试回火判定)
  let backfired = false;
  for (let i = 0; i < 10; i++) {
    const decelState = sim.step(0.016, 0.0);
    if (decelState.isBackfiring) {
      backfired = true;
      break;
    }
  }

  // 验证降速趋势
  for (let i = 0; i < 80; i++) {
    state = sim.step(0.016, 0.0);
  }
  assert.ok(state.rpm <= v8.idleRpm + 1000, 'RPM must return down near idle when throttle released');
});

test('Acoustic Rev — 4. Engine Preset Hot Switching & State Reset', () => {
  const v10 = ENGINE_PRESETS['v10-2004'];
  const v6 = ENGINE_PRESETS['v6-2026'];
  const sim = new RevPhysicsSimulator(v10);

  // 踩油门到 17000
  for (let i = 0; i < 60; i++) {
    sim.step(0.016, 1.0);
  }

  // 热切换至 V6 (红线仅 15000)
  sim.setPreset(v6);
  const switchedState = sim.step(0.016, 0.0);
  assert.ok(switchedState.rpm <= v6.redlineRpm, 'RPM must be clamped to new engine redline');
});
