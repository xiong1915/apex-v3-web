// lib/audio/rev-physics.ts
// APEX V3 Acoustic Rev — F1 Engine RPM Physics Simulation

import { EnginePreset } from './engine-presets';

export interface PhysicsState {
  rpm: number;
  throttle: number; // 0.0 to 1.0
  isLimiterActive: boolean;
  isBackfiring: boolean;
  backfireCount: number;
  engineLoad: number; // 0.0 to 1.0
}

export class RevPhysicsSimulator {
  private preset: EnginePreset;
  private currentRpm: number = 0;
  private currentThrottle: number = 0;
  private prevThrottle: number = 0;
  private limiterBounceOffset: number = 0;
  private limiterPhase: number = 0;
  private isBackfiring: boolean = false;
  private backfireTimer: number = 0;
  private backfireCount: number = 0;
  private isIgnited: boolean = true;

  constructor(preset: EnginePreset, autoIgnite: boolean = true) {
    this.preset = preset;
    this.isIgnited = autoIgnite;
    this.currentRpm = autoIgnite ? preset.idleRpm : 0;
  }

  public setIgnited(ignited: boolean): void {
    this.isIgnited = ignited;
    if (!ignited) {
      this.isBackfiring = false;
      this.backfireTimer = 0;
      this.currentThrottle = 0;
    }
  }

  public isRunning(): boolean {
    return this.isIgnited;
  }

  public setPreset(newPreset: EnginePreset): void {
    this.preset = newPreset;
    if (this.isIgnited) {
      this.currentRpm = Math.max(newPreset.idleRpm, Math.min(this.currentRpm, newPreset.redlineRpm));
    }
  }

  /**
   * 按帧时间步长更新转速物理状态
   * @param dtSeconds 帧间隔时间（秒）
   * @param targetThrottle 目标油门开度（0.0 ~ 1.0）
   */
  public step(dtSeconds: number, targetThrottle: number): PhysicsState {
    // 限制单步时间，防止后台标签唤醒时出现时间跳跃
    const dt = Math.max(0.001, Math.min(dtSeconds, 0.064));

    // 1. 若处于熄火状态，转速快速衰减至 0
    if (!this.isIgnited) {
      this.currentThrottle = 0;
      this.prevThrottle = 0;
      this.isBackfiring = false;
      if (this.currentRpm > 0) {
        const decel = Math.max(20000 * dt, this.currentRpm * 6 * dt);
        this.currentRpm = Math.max(0, this.currentRpm - decel);
      }
      return {
        rpm: Math.round(this.currentRpm),
        throttle: 0,
        isLimiterActive: false,
        isBackfiring: false,
        backfireCount: 0,
        engineLoad: 0
      };
    }

    // 2. 处于已点火运行状态
    const throttle = Math.max(0, Math.min(1, targetThrottle));

    // 油门平滑追随（模拟电子节气门延迟）
    const throttleLag = throttle > this.currentThrottle ? 18 : 22;
    this.currentThrottle += (throttle - this.currentThrottle) * Math.min(1, dt * throttleLag);

    // 初始点火若未到怠速，自动冲至怠速
    const targetRpm =
      this.preset.idleRpm + this.currentThrottle * (this.preset.limiterRpm - this.preset.idleRpm);

    // 3. 转速惯性计算（加速与降速阻尼分离）
    if (this.currentRpm < targetRpm) {
      // 加速阶段（空载高转速飙升）
      const stepAccel = this.preset.accelerationRate * dt * (0.6 + 0.4 * this.currentThrottle);
      this.currentRpm = Math.min(targetRpm, this.currentRpm + stepAccel);
    } else if (this.currentRpm > targetRpm) {
      // 降速阶段（轻量化飞轮惯性衰减）
      const stepDecel =
        this.preset.decelerationRate * dt * (0.8 + 0.2 * (this.currentRpm / this.preset.redlineRpm));
      this.currentRpm = Math.max(targetRpm, this.currentRpm - stepDecel);
    }

    // 4. 红线断油限制器模拟 (Rev Limiter Bounce)
    let isLimiterActive = false;
    if (this.currentRpm >= this.preset.redlineRpm) {
      isLimiterActive = true;
      this.limiterPhase += dt * 50; // 50Hz 断油顿挫频率
      this.limiterBounceOffset = Math.sin(this.limiterPhase) * 350 - 150;
      this.currentRpm = Math.min(this.preset.limiterRpm, this.currentRpm + this.limiterBounceOffset);
    } else {
      this.limiterPhase = 0;
      this.limiterBounceOffset = 0;
    }

    // 5. 松油门回火放炮判定 (Backfire / Pops on Overrun)
    // 触发条件：先前处于较高转速与高油门，突然松开油门（负负载突变）
    const throttleDrop = this.prevThrottle - throttle;
    if (
      throttleDrop > 0.35 &&
      this.currentRpm > this.preset.idleRpm + 4000 &&
      !this.isBackfiring &&
      Math.random() < 0.65
    ) {
      this.isBackfiring = true;
      this.backfireTimer = 0.25; // 持续 250ms
      this.backfireCount = Math.floor(Math.random() * 2) + 1; // 1~2 次爆响
    }

    if (this.isBackfiring) {
      this.backfireTimer -= dt;
      if (this.backfireTimer <= 0) {
        this.isBackfiring = false;
      }
    }

    this.prevThrottle = throttle;

    // 确保已点火状态下转速在怠速以上
    this.currentRpm = Math.max(this.preset.idleRpm, this.currentRpm);

    return {
      rpm: Math.round(this.currentRpm),
      throttle: this.currentThrottle,
      isLimiterActive,
      isBackfiring: this.isBackfiring,
      backfireCount: this.backfireCount,
      engineLoad: Math.max(
        0,
        Math.min(
          1,
          (this.currentRpm - this.preset.idleRpm) /
            (this.preset.redlineRpm - this.preset.idleRpm)
        )
      )
    };
  }

  public reset(rpm?: number): void {
    this.currentRpm = rpm ?? (this.isIgnited ? this.preset.idleRpm : 0);
    this.currentThrottle = 0;
    this.prevThrottle = 0;
    this.isBackfiring = false;
    this.backfireTimer = 0;
  }
}
