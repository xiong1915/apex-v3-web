// tests/arcade-physics.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_SPECS } from '../lib/arcade/car-specs';
import { DragPhysicsEngine } from '../lib/arcade/drag-physics';

test('Arcade Physics — 1. Car Specifications & Powertrain Sanity', () => {
  const v10 = CAR_SPECS['v10-2004'];
  const v8 = CAR_SPECS['v8-2010'];
  const v6 = CAR_SPECS['v6-2026'];

  assert.ok(v10 && v8 && v6, 'All 3 car specs must exist');
  assert.equal(v10.totalGears, 7);
  assert.equal(v8.totalGears, 7);
  assert.equal(v6.totalGears, 8);

  // 齿比必须严格单调递减 (1挡最大，最高挡最小)
  for (let i = 0; i < v10.gearRatios.length - 1; i++) {
    assert.ok(v10.gearRatios[i] > v10.gearRatios[i + 1], `Gear ${i + 1} ratio must be higher than gear ${i + 2}`);
  }

  // 扭矩曲线非零非负
  assert.ok(v10.getTorqueNm(15000) > 300);
  assert.ok(v6.getTorqueNm(5000) > 350, 'V6 Hybrid must have immense low-end torque');
});

test('Arcade Physics — 2. Staging in Neutral & Launch Dynamics', () => {
  const v10 = CAR_SPECS['v10-2004'];
  const engine = new DragPhysicsEngine(v10);

  // 1. 空挡待机时踩油门蓄转速，车速与距离必须为 0
  const state0 = engine.step(0.016, 0.8, false);
  assert.equal(state0.gear, 0);
  assert.equal(state0.speedKmh, 0);
  assert.equal(state0.distanceM, 0);

  for (let i = 0; i < 30; i++) {
    engine.step(0.016, 0.8, false);
  }
  const stagedState = engine.step(0.016, 0.8, false);
  assert.ok(stagedState.rpm > 10000, 'RPM should climb while staging in neutral');
  assert.equal(stagedState.speedKmh, 0, 'Car must not move while in neutral');

  // 2. 弹射发车挂入 1 挡
  const launchResult = engine.launch();
  assert.ok(['PERFECT', 'GOOD', 'WHEEL_SPIN', 'BOG_DOWN'].includes(launchResult.quality));

  const runState1 = engine.step(0.016, 1.0, true);
  assert.equal(runState1.gear, 1);
  assert.ok(runState1.speedKmh > 0, 'Car should begin accelerating after launch');
});

test('Arcade Physics — 3. Gear Shifting Quality & RPM Drops', () => {
  const v8 = CAR_SPECS['v8-2010'];
  const engine = new DragPhysicsEngine(v8);
  engine.launch();

  // 1 挡全油门加速至 optimalShiftRpm 范围内
  let state = engine.step(0.016, 1.0, true);
  for (let i = 0; i < 260; i++) {
    state = engine.step(0.016, 1.0, true);
    if (state.rpm >= v8.optimalShiftRpmMin) break;
  }

  // 升 2 挡 -> 应该判定为 PERFECT 或 GOOD
  const shiftRes = engine.shiftUp();
  assert.equal(shiftRes.success, true);
  assert.ok(['PERFECT', 'GOOD'].includes(shiftRes.quality));

  const postShiftState = engine.step(0.016, 1.0, true);
  assert.equal(postShiftState.gear, 2);
  assert.ok(postShiftState.rpm < state.rpm, 'RPM must drop after upshift into taller gear');

  // 早期升挡测试 (转速极低时升 3 挡)
  const earlyShiftRes = engine.shiftUp();
  assert.equal(earlyShiftRes.success, true);
  assert.equal(earlyShiftRes.quality, 'EARLY', 'Shifting at low RPM must be categorized as EARLY');
});

test('Arcade Physics — 4. Over-rev Downshift Protection', () => {
  const v10 = CAR_SPECS['v10-2004'];
  const engine = new DragPhysicsEngine(v10);
  engine.launch();

  // 1 挡提速 -> 升 2 挡 -> 升 3 挡并在 400 米内加速至 240+ km/h
  for (let i = 0; i < 120; i++) engine.step(0.016, 1.0, true);
  engine.shiftUp(); // 2 挡
  for (let i = 0; i < 100; i++) engine.step(0.016, 1.0, true);
  engine.shiftUp(); // 3 挡
  for (let i = 0; i < 150; i++) engine.step(0.016, 1.0, true);

  // 此时车速在 240+ km/h，若降到 2 挡会导致转速突破 19200 RPM，必触发过转安全保护
  const res = engine.shiftDown();
  assert.equal(res.success, false);
  assert.equal(res.reason?.includes('OVER-REV'), true, 'Downshift protection must block over-rev at high speeds');
});

test('Arcade Physics — 5. Full 400m Quarter-Mile Race Simulation', () => {
  const v10 = CAR_SPECS['v10-2004'];
  const engine = new DragPhysicsEngine(v10);
  engine.launch();

  let state = engine.step(0.016, 1.0, true);
  let totalTicks = 0;

  // 模拟全油门并在转速接近红线时自动升挡
  while (!state.isFinished && totalTicks < 2500) {
    totalTicks++;
    if (state.rpm >= v10.optimalShiftRpmMin && state.gear < v10.totalGears) {
      engine.shiftUp();
    }
    state = engine.step(0.016, 1.0, true);
  }

  assert.equal(state.isFinished, true, 'Car must finish 400m drag strip');
  assert.ok(state.time0To100 !== null && state.time0To100 > 1.8 && state.time0To100 < 3.8, '0-100 time must be physically realistic');
  assert.ok(state.time400m !== null && state.time400m > 7.5 && state.time400m < 13.5, '400m time must be realistic for F1 drag race');
  assert.ok(state.trapSpeedKmh !== null && state.trapSpeedKmh > 240, 'Trap speed must exceed 240 km/h');
});
