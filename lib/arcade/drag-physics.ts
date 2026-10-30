// lib/arcade/drag-physics.ts
// APEX V3 Acoustic Rev Arcade — 1D Longitudinal Vehicle & Powertrain Physics Engine

import { CarSpec } from './car-specs';

export type ShiftQuality = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE' | 'LIMITER' | 'NONE';

export interface DragRaceTelemetry {
  speedKmh: number;
  speedMs: number;
  distanceM: number;
  rpm: number;
  gear: number; // 0 = N, 1..7/8
  accelerationG: number;
  isWheelSpinning: boolean;
  isLimiterActive: boolean;
  shiftInterruption: boolean;
  lastShiftQuality: ShiftQuality;
  perfectShiftCount: number;
  // 成绩分段
  time0To100: number | null;
  time0To200: number | null;
  time400m: number | null;
  trapSpeedKmh: number | null;
  isFinished: boolean;
}

export class DragPhysicsEngine {
  private spec: CarSpec;
  private gear: number = 0; // 0 = 空挡 / 离合切断
  private speedMs: number = 0;
  private distanceM: number = 0;
  private rpm: number = 0;
  private currentThrottle: number = 0;

  // 换挡动力中断计时器
  private shiftTimer: number = 0;
  private lastShiftQuality: ShiftQuality = 'NONE';
  private perfectShiftCount: number = 0;

  // 断油限制震颤相位
  private limiterPhase: number = 0;
  private isLimiterActive: boolean = false;
  private isWheelSpinning: boolean = false;

  // 成绩记录
  private time0To100: number | null = null;
  private time0To200: number | null = null;
  private time400m: number | null = null;
  private trapSpeedKmh: number | null = null;
  private isFinished: boolean = false;
  private raceElapsedTime: number = 0;
  private isLaunched: boolean = false;

  constructor(spec: CarSpec) {
    this.spec = spec;
    this.rpm = spec.enginePreset.idleRpm;
  }

  public getGear(): number {
    return this.gear;
  }

  public reset(spec?: CarSpec): void {
    if (spec) this.spec = spec;
    this.gear = 0;
    this.speedMs = 0;
    this.distanceM = 0;
    this.rpm = this.spec.enginePreset.idleRpm;
    this.currentThrottle = 0;
    this.shiftTimer = 0;
    this.lastShiftQuality = 'NONE';
    this.perfectShiftCount = 0;
    this.isLimiterActive = false;
    this.isWheelSpinning = false;
    this.time0To100 = null;
    this.time0To200 = null;
    this.time400m = null;
    this.trapSpeedKmh = null;
    this.isFinished = false;
    this.raceElapsedTime = 0;
    this.isLaunched = false;
  }

  /**
   * 发车离合器释放：挂入 1 挡
   */
  public launch(): { quality: 'PERFECT' | 'GOOD' | 'WHEEL_SPIN' | 'BOG_DOWN' } {
    if (this.gear !== 0) return { quality: 'GOOD' };
    this.gear = 1;
    this.isLaunched = true;

    // 弹射起步品质判定
    let quality: 'PERFECT' | 'GOOD' | 'WHEEL_SPIN' | 'BOG_DOWN' = 'GOOD';
    if (this.rpm >= this.spec.launchRpmMin && this.rpm <= this.spec.launchRpmMax) {
      quality = 'PERFECT';
      this.isWheelSpinning = false;
    } else if (this.rpm > this.spec.launchRpmMax) {
      quality = 'WHEEL_SPIN';
      this.isWheelSpinning = true;
    } else if (this.rpm < this.spec.enginePreset.idleRpm + 2500) {
      quality = 'BOG_DOWN';
      this.isWheelSpinning = false;
      // 掉转速阻尼
      this.rpm = Math.max(this.spec.enginePreset.idleRpm, this.rpm - 1500);
    }

    return { quality };
  }

  /**
   * 升挡操作 (Shift Up)
   */
  public shiftUp(): { success: boolean; quality: ShiftQuality } {
    if (this.isFinished || this.gear >= this.spec.totalGears) {
      return { success: false, quality: 'NONE' };
    }

    // 从 0 挡 (N) 升到 1 挡视为发车
    if (this.gear === 0) {
      const { quality } = this.launch();
      return { success: true, quality: quality === 'PERFECT' ? 'PERFECT' : 'GOOD' };
    }

    // 换挡转速品质判定
    let quality: ShiftQuality = 'GOOD';
    if (this.rpm >= this.spec.optimalShiftRpmMin && this.rpm <= this.spec.optimalShiftRpmMax) {
      quality = 'PERFECT';
      this.perfectShiftCount++;
    } else if (this.rpm < this.spec.optimalShiftRpmMin - 2000) {
      quality = 'EARLY';
    } else if (this.rpm >= this.spec.enginePreset.redlineRpm) {
      quality = this.isLimiterActive ? 'LIMITER' : 'LATE';
    }

    this.gear += 1;
    this.lastShiftQuality = quality;
    // 换挡动力中断时间：完美换挡仅 0.05s，断油换挡或过早换挡 0.10s
    this.shiftTimer = quality === 'PERFECT' ? 0.05 : 0.10;

    // 重新计算并回落转速至新挡位
    const newRatio = this.spec.gearRatios[this.gear - 1];
    const wheelCircumference = Math.PI * this.spec.wheelDiameterM;
    const targetRpm =
      (this.speedMs * 60 * newRatio * this.spec.finalDriveRatio) / wheelCircumference;
    this.rpm = Math.max(this.spec.enginePreset.idleRpm, Math.round(targetRpm));

    return { success: true, quality };
  }

  /**
   * 降挡操作 (Shift Down，含过转保护)
   */
  public shiftDown(): { success: boolean; reason?: string } {
    if (this.gear <= 1) {
      return { success: false, reason: 'Already in lowest gear' };
    }

    const lowerGear = this.gear - 1;
    const lowerRatio = this.spec.gearRatios[lowerGear - 1];
    const wheelCircumference = Math.PI * this.spec.wheelDiameterM;
    const predictedRpm =
      (this.speedMs * 60 * lowerRatio * this.spec.finalDriveRatio) / wheelCircumference;

    // 过转爆缸防御：如果降挡转速突破断油线以上，变速箱安全锁止保护
    if (predictedRpm > this.spec.enginePreset.limiterRpm) {
      return { success: false, reason: 'OVER-REV PROTECTION: Downshift blocked' };
    }

    if (this.isFinished) {
      return { success: false, reason: 'Race finished' };
    }

    this.gear = lowerGear;
    this.shiftTimer = 0.08;
    this.rpm = Math.max(this.spec.enginePreset.idleRpm, Math.round(predictedRpm));
    return { success: true };
  }

  /**
   * 步进物理计算
   * @param dtSeconds 时间步长
   * @param targetThrottle 目标油门 (0.0 ~ 1.0)
   * @param isRaceActive 比赛是否处于绿灯行进阶段
   */
  public step(dtSeconds: number, targetThrottle: number, isRaceActive: boolean): DragRaceTelemetry {
    const dt = Math.max(0.001, Math.min(dtSeconds, 0.05));
    const throttle = Math.max(0, Math.min(1, targetThrottle));

    // 电子油门跟随
    this.currentThrottle += (throttle - this.currentThrottle) * Math.min(1, dt * 20);

    // 1. 空挡待机状态 (自由蓄转速)
    if (this.gear === 0) {
      const targetFreeRpm =
        this.spec.enginePreset.idleRpm +
        this.currentThrottle * (this.spec.enginePreset.limiterRpm - this.spec.enginePreset.idleRpm);

      if (this.rpm < targetFreeRpm) {
        this.rpm = Math.min(targetFreeRpm, this.rpm + this.spec.enginePreset.accelerationRate * dt);
      } else if (this.rpm > targetFreeRpm) {
        this.rpm = Math.max(targetFreeRpm, this.rpm - this.spec.enginePreset.decelerationRate * dt);
      }

      this.isLimiterActive = this.rpm >= this.spec.enginePreset.redlineRpm;

      return {
        speedKmh: 0,
        speedMs: 0,
        distanceM: 0,
        rpm: Math.round(this.rpm),
        gear: 0,
        accelerationG: 0,
        isWheelSpinning: false,
        isLimiterActive: this.isLimiterActive,
        shiftInterruption: false,
        lastShiftQuality: this.lastShiftQuality,
        perfectShiftCount: this.perfectShiftCount,
        time0To100: null,
        time0To200: null,
        time400m: null,
        trapSpeedKmh: null,
        isFinished: false
      };
    }

    // 2. 挂挡行进状态
    if (isRaceActive && !this.isFinished) {
      this.raceElapsedTime += dt;
    }

    // 换挡动力中断计时
    let effectiveDriveForce = 0;
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      // 换挡期间离合切断，无驱动力
      effectiveDriveForce = 0;
    } else {
      // 动力系统输出扭矩
      const engineTorque = this.spec.getTorqueNm(this.rpm) * this.currentThrottle;
      const currentRatio = this.spec.gearRatios[this.gear - 1] || 1.0;
      const wheelTorque = engineTorque * currentRatio * this.spec.finalDriveRatio * 0.94; // 94% 传动效率
      const wheelRadius = this.spec.wheelDiameterM / 2;
      const theoreticalDriveForce = wheelTorque / wheelRadius;

      // 轮胎最大极限抓地力 (干地赛车热熔胎 + 气动下压力)
      const airDensity = 1.225;
      const downforceN = 0.5 * airDensity * this.spec.downforceCoeff * (this.speedMs * this.speedMs);
      const normalForceN = this.spec.massKg * 9.81 + downforceN;
      const maxTractionForce = normalForceN * this.spec.tireGripCoeff;

      if (theoreticalDriveForce > maxTractionForce) {
        this.isWheelSpinning = true;
        // 打滑时驱动力受限为滑动摩擦并损失 10%
        effectiveDriveForce = maxTractionForce * 0.90;
      } else {
        this.isWheelSpinning = false;
        effectiveDriveForce = theoreticalDriveForce;
      }
    }

    // 空气阻力与滚动阻力
    const aeroDragN = 0.5 * 1.225 * this.spec.cdA * (this.speedMs * this.speedMs);
    const rollingResistanceN = 0.015 * this.spec.massKg * 9.81;
    const totalResistanceN = aeroDragN + rollingResistanceN;

    const netForceN = Math.max(-totalResistanceN, effectiveDriveForce - totalResistanceN);
    const accelMs2 = netForceN / this.spec.massKg;

    // 速度与距离积分
    this.speedMs = Math.max(0, this.speedMs + accelMs2 * dt);
    this.distanceM += this.speedMs * dt;
    const speedKmh = this.speedMs * 3.6;

    // 轮速反算引擎 RPM
    const wheelCircumference = Math.PI * this.spec.wheelDiameterM;
    const currentRatio = this.spec.gearRatios[this.gear - 1] || 1.0;
    const gearCalculatedRpm =
      (this.speedMs * 60 * currentRatio * this.spec.finalDriveRatio) / wheelCircumference;

    // 起步离合器滑磨阶段 (0 ~ 55 km/h)：保持高爆发转速，平滑过渡至轮速
    if (this.gear === 1 && this.speedMs < 15) {
      const slipRatio = Math.min(1, Math.max(0, this.speedMs / 15));
      const targetLaunchRpm = Math.max(
        this.spec.launchRpmMin,
        this.spec.enginePreset.idleRpm + this.currentThrottle * (this.spec.enginePreset.redlineRpm * 0.75 - this.spec.enginePreset.idleRpm)
      );
      this.rpm = targetLaunchRpm * (1 - slipRatio) + gearCalculatedRpm * slipRatio;
    } else {
      this.rpm = Math.max(this.spec.enginePreset.idleRpm, gearCalculatedRpm);
    }

    // 断油限制器判定
    if (this.rpm >= this.spec.enginePreset.limiterRpm) {
      this.isLimiterActive = true;
      this.limiterPhase += dt * 50;
      this.rpm = this.spec.enginePreset.limiterRpm + Math.sin(this.limiterPhase) * 200 - 100;
    } else {
      this.isLimiterActive = false;
    }

    // 0-100 km/h 记录
    if (speedKmh >= 100 && this.time0To100 === null) {
      this.time0To100 = Math.round(this.raceElapsedTime * 1000) / 1000;
    }

    // 0-200 km/h 记录
    if (speedKmh >= 200 && this.time0To200 === null) {
      this.time0To200 = Math.round(this.raceElapsedTime * 1000) / 1000;
    }

    // 400 米冲线判定
    if (this.distanceM >= 400 && !this.isFinished) {
      this.isFinished = true;
      this.time400m = Math.round(this.raceElapsedTime * 1000) / 1000;
      this.trapSpeedKmh = Math.round(speedKmh * 10) / 10;
    }

    return {
      speedKmh: Math.round(speedKmh * 10) / 10,
      speedMs: this.speedMs,
      distanceM: Math.round(this.distanceM * 10) / 10,
      rpm: Math.round(this.rpm),
      gear: this.gear,
      accelerationG: Math.round((accelMs2 / 9.81) * 100) / 100,
      isWheelSpinning: this.isWheelSpinning,
      isLimiterActive: this.isLimiterActive,
      shiftInterruption: this.shiftTimer > 0,
      lastShiftQuality: this.lastShiftQuality,
      perfectShiftCount: this.perfectShiftCount,
      time0To100: this.time0To100,
      time0To200: this.time0To200,
      time400m: this.time400m,
      trapSpeedKmh: this.trapSpeedKmh,
      isFinished: this.isFinished
    };
  }
}
