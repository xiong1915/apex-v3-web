// lib/arcade/car-specs.ts
// APEX V3 Acoustic Rev Arcade — F1 Car Specifications & Gearbox Ratios

import { EnginePreset, ENGINE_PRESETS } from '../audio/engine-presets';

export interface CarSpec {
  id: 'v10-2004' | 'v8-2010' | 'v6-2026';
  name: string;
  shortName: string;
  enginePreset: EnginePreset;
  massKg: number; // 车重 (含车手)
  totalGears: number; // 前进挡位数 (7 或 8)
  gearRatios: number[]; // 各挡齿比 (1 挡 ~ 7/8 挡)
  finalDriveRatio: number; // 最终减速比
  wheelDiameterM: number; // 轮胎有效外径 (米)
  cdA: number; // 风阻系数 * 迎风面积
  downforceCoeff: number; // 下压力系数
  tireGripCoeff: number; // 轮胎干地抓地力摩擦系数 mu
  // 最佳升挡转速区间 (RPM)
  optimalShiftRpmMin: number;
  optimalShiftRpmMax: number;
  // 起步弹射最佳转速区间
  launchRpmMin: number;
  launchRpmMax: number;
  // 引擎特征扭矩曲线计算函数
  getTorqueNm: (rpm: number) => number;
}

export const CAR_SPECS: Record<string, CarSpec> = {
  'v10-2004': {
    id: 'v10-2004',
    name: '2004 V10 · F2004 风格',
    shortName: '2004 V10',
    enginePreset: ENGINE_PRESETS['v10-2004'],
    massKg: 605,
    totalGears: 7,
    gearRatios: [3.18, 2.42, 1.92, 1.58, 1.32, 1.13, 0.98],
    finalDriveRatio: 4.05,
    wheelDiameterM: 0.66,
    cdA: 1.15,
    downforceCoeff: 2.1,
    tireGripCoeff: 1.65,
    optimalShiftRpmMin: 18300,
    optimalShiftRpmMax: 18900,
    launchRpmMin: 11000,
    launchRpmMax: 12500,
    getTorqueNm: (rpm: number) => {
      // 3.0L 自然吸气 V10：高转爆发型，峰值在 14500~17500 RPM 达到 ~390 N·m
      if (rpm < 3500) return 180;
      if (rpm < 10000) return 220 + (rpm - 3500) * 0.018;
      if (rpm <= 17500) return 337 + ((rpm - 10000) / 7500) * 55;
      // 超出 17500 扭矩平缓衰退
      return Math.max(280, 392 - (rpm - 17500) * 0.06);
    }
  },
  'v8-2010': {
    id: 'v8-2010',
    name: '2010 V8 · RB6 风格',
    shortName: '2010 V8',
    enginePreset: ENGINE_PRESETS['v8-2010'],
    massKg: 620,
    totalGears: 7,
    gearRatios: [3.25, 2.48, 1.96, 1.61, 1.34, 1.15, 1.01],
    finalDriveRatio: 3.95,
    wheelDiameterM: 0.66,
    cdA: 1.18,
    downforceCoeff: 2.2,
    tireGripCoeff: 1.62,
    optimalShiftRpmMin: 17300,
    optimalShiftRpmMax: 17850,
    launchRpmMin: 10500,
    launchRpmMax: 11800,
    getTorqueNm: (rpm: number) => {
      // 2.4L 自然吸气 V8：中高频饱满，峰值在 13500~16500 RPM 达到 ~355 N·m
      if (rpm < 3200) return 160;
      if (rpm < 9000) return 200 + (rpm - 3200) * 0.016;
      if (rpm <= 16500) return 292 + ((rpm - 9000) / 7500) * 63;
      return Math.max(260, 355 - (rpm - 16500) * 0.07);
    }
  },
  'v6-2026': {
    id: 'v6-2026',
    name: '2026 V6 Turbo Hybrid',
    shortName: '2026 V6 Turbo',
    enginePreset: ENGINE_PRESETS['v6-2026'],
    massKg: 798,
    totalGears: 8,
    gearRatios: [3.45, 2.62, 2.05, 1.68, 1.40, 1.19, 1.03, 0.90],
    finalDriveRatio: 3.82,
    wheelDiameterM: 0.72,
    cdA: 1.08,
    downforceCoeff: 1.95,
    tireGripCoeff: 1.70,
    optimalShiftRpmMin: 14200,
    optimalShiftRpmMax: 14850,
    launchRpmMin: 8500,
    launchRpmMax: 9800,
    getTorqueNm: (rpm: number) => {
      // 1.6L 涡轮增压混动：强劲低扭 + 电机辅助 (MGU-K)，低中转速峰值高达 460 N·m
      if (rpm < 3000) return 260;
      if (rpm < 7000) return 360 + (rpm - 3000) * 0.025;
      if (rpm <= 13500) return 460 - ((rpm - 7000) / 6500) * 40;
      return Math.max(340, 420 - (rpm - 13500) * 0.05);
    }
  }
};
