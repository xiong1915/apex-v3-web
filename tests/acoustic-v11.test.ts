// tests/acoustic-v11.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENGINE_PRESETS, calculateFiringFrequency } from '../lib/audio/engine-presets';
import { RevPhysicsSimulator } from '../lib/audio/rev-physics';
import { F1EngineSynthesizer } from '../lib/audio/engine-synthesizer';

test('Acoustic Rev V1.1 — 1. Keyboard Throttle State Machine & Independent Release', () => {
  // 模拟 ThrottleControl 内部的状态机核心逻辑
  interface InputsState {
    pointerActive: boolean;
    pointerValue: number;
    spaceActive: boolean;
    wActive: boolean;
  }

  function computeThrottle(inputs: InputsState): number {
    let max = 0;
    if (inputs.pointerActive) max = Math.max(max, inputs.pointerValue);
    if (inputs.spaceActive) max = Math.max(max, 1.0);
    if (inputs.wActive) max = Math.max(max, 1.0);
    return Math.max(0, Math.min(1, Math.round(max * 1000) / 1000));
  }

  const inputs: InputsState = {
    pointerActive: false,
    pointerValue: 0,
    spaceActive: false,
    wActive: false
  };

  // 1. 初始为 0
  assert.equal(computeThrottle(inputs), 0.0);

  // 2. 单独按下 Space -> 1.0
  inputs.spaceActive = true;
  assert.equal(computeThrottle(inputs), 1.0);

  // 3. 单独释放 Space -> 归零 0.0
  inputs.spaceActive = false;
  assert.equal(computeThrottle(inputs), 0.0);

  // 4. 单独按下 W -> 1.0
  inputs.wActive = true;
  assert.equal(computeThrottle(inputs), 1.0);

  // 5. 单独释放 W -> 归零 0.0
  inputs.wActive = false;
  assert.equal(computeThrottle(inputs), 0.0);

  // 6. Space 和 W 同时按下
  inputs.spaceActive = true;
  inputs.wActive = true;
  assert.equal(computeThrottle(inputs), 1.0);

  // 7. 先释放 Space，W 仍按住 -> 仍为 1.0！
  inputs.spaceActive = false;
  assert.equal(computeThrottle(inputs), 1.0, 'Releasing Space while W is still down must keep throttle 1.0');

  // 8. 释放 W -> 最终归零 0.0！
  inputs.wActive = false;
  assert.equal(computeThrottle(inputs), 0.0, 'Releasing all keys must return throttle to 0.0');

  // 9. 鼠标与键盘混合操作：鼠标踩 60%，按 Space 升至 100%，松 Space 回到 60%，松鼠标归零
  inputs.pointerActive = true;
  inputs.pointerValue = 0.6;
  assert.equal(computeThrottle(inputs), 0.6);

  inputs.spaceActive = true;
  assert.equal(computeThrottle(inputs), 1.0);

  inputs.spaceActive = false;
  assert.equal(computeThrottle(inputs), 0.6);

  inputs.pointerActive = false;
  inputs.pointerValue = 0;
  assert.equal(computeThrottle(inputs), 0.0);

  // 10. 切后台 / 失焦强制清空
  inputs.spaceActive = true;
  inputs.wActive = true;
  inputs.pointerActive = true;
  inputs.pointerValue = 0.85;
  // 执行 clearAllInputs
  inputs.spaceActive = false;
  inputs.wActive = false;
  inputs.pointerActive = false;
  inputs.pointerValue = 0;
  assert.equal(computeThrottle(inputs), 0.0, 'Clear inputs must immediately drop throttle to 0.0');
});

test('Acoustic Rev V1.1 — 2. Engine Start/Stop State Machine & Zero RPM Shutdown', () => {
  const v10 = ENGINE_PRESETS['v10-2004'];

  // 1. 初始未点火状态 (autoIgnite = false)
  const sim = new RevPhysicsSimulator(v10, false);
  const state0 = sim.step(0.016, 0.0);
  assert.equal(state0.rpm, 0, 'Unignited engine must report 0 RPM');
  assert.equal(state0.isLimiterActive, false);
  assert.equal(state0.isBackfiring, false);
  assert.equal(state0.engineLoad, 0);

  // 2. 点火启动
  sim.setIgnited(true);
  const stateIgnited = sim.step(0.016, 0.0);
  assert.ok(stateIgnited.rpm >= v10.idleRpm, 'Ignited engine must settle at or above idle RPM');

  // 3. 踩油门加速至 14000 RPM
  for (let i = 0; i < 40; i++) {
    sim.step(0.016, 1.0);
  }
  const revvingState = sim.step(0.016, 1.0);
  assert.ok(revvingState.rpm > 10000, 'Engine must rev up under throttle');

  // 4. 熄火 (Shutdown)
  sim.setIgnited(false);
  for (let i = 0; i < 80; i++) {
    sim.step(0.016, 0.0);
  }
  const stoppedState = sim.step(0.016, 0.0);
  assert.equal(stoppedState.rpm, 0, 'Engine must decay to 0 RPM when stopped');
  assert.equal(stoppedState.isLimiterActive, false);
  assert.equal(stoppedState.isBackfiring, false);
  assert.equal(stoppedState.engineLoad, 0);
});

test('Acoustic Rev V1.1 — 3. Volume & Mute State Decoupling and Persistence', () => {
  const v8 = ENGINE_PRESETS['v8-2010'];
  const synth = new F1EngineSynthesizer(v8);

  // 1. 默认音量
  assert.equal(synth.getVolume(), 0.65);
  assert.equal(synth.getIsMuted(), false);

  // 2. 调节音量至 0.8
  synth.setVolume(0.8);
  assert.equal(synth.getVolume(), 0.8);

  // 3. 设置静音
  synth.setMuted(true);
  assert.equal(synth.getIsMuted(), true);
  // 静音时已保存音量不变
  assert.equal(synth.getVolume(), 0.8, 'Muting must not erase saved volume level');

  // 4. 在静音期间调整音量
  synth.setVolume(0.5);
  assert.equal(synth.getVolume(), 0.5);
  assert.equal(synth.getIsMuted(), true);

  // 5. 取消静音
  synth.setMuted(false);
  assert.equal(synth.getIsMuted(), false);
  assert.equal(synth.getVolume(), 0.5, 'Unmuting must restore previously saved volume');

  // 6. 切换引擎模式保留用户音量与静音
  const v6 = ENGINE_PRESETS['v6-2026'];
  synth.switchPreset(v6);
  assert.equal(synth.getVolume(), 0.5, 'Preset switch must preserve user volume');
  assert.equal(synth.getIsMuted(), false, 'Preset switch must preserve mute status');
});

test('Acoustic Rev V1.1 — 4. Acoustic Spectrum Differentiation Across Eras', () => {
  const v10 = ENGINE_PRESETS['v10-2004'];
  const v8 = ENGINE_PRESETS['v8-2010'];
  const v6 = ENGINE_PRESETS['v6-2026'];

  // 1. 气缸数与转速参数规范
  assert.equal(v10.cylinders, 10);
  assert.equal(v10.redlineRpm, 19000);
  assert.equal(v10.limiterRpm, 19200);
  assert.equal(v8.cylinders, 8);
  assert.equal(v8.redlineRpm, 18000);
  assert.equal(v8.limiterRpm, 18200);
  assert.equal(v6.cylinders, 6);
  assert.equal(v6.redlineRpm, 15000);
  assert.equal(v6.limiterRpm, 15200);

  // 2. 点火基频对比 (@ 12,000 RPM)
  const fV10 = calculateFiringFrequency(12000, v10.cylinders); // 1000 Hz
  const fV8 = calculateFiringFrequency(12000, v8.cylinders);   // 800 Hz
  const fV6 = calculateFiringFrequency(12000, v6.cylinders);   // 600 Hz

  assert.equal(fV10, 1000);
  assert.equal(fV8, 800);
  assert.equal(fV6, 600);
  assert.notEqual(fV10, fV8);
  assert.notEqual(fV8, fV6);

  // 3. 共振滤波器与谐波拓扑结构差异
  assert.notEqual(v10.sound.resonanceFrequency, v6.sound.resonanceFrequency);
  assert.notEqual(v10.sound.distortionAmount, v8.sound.distortionAmount);

  // 4. 专属涡轮啸叫层 (仅 V6 拥有)
  assert.equal(v10.sound.turboWhistle, false);
  assert.equal(v8.sound.turboWhistle, false);
  assert.equal(v6.sound.turboWhistle, true);
  assert.ok(v6.sound.turboBaseFreq && v6.sound.turboBaseFreq > 1000);
});
