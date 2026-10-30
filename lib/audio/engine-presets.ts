// lib/audio/engine-presets.ts
// APEX V3 Acoustic Rev — F1 Engine Presets & Specifications

export interface EnginePreset {
  id: 'v10-2004' | 'v8-2010' | 'v6-2026';
  name: string;
  tagline: string;
  cylinders: number;
  idleRpm: number;
  redlineRpm: number;
  limiterRpm: number;
  accelerationRate: number; // RPM per second at 100% throttle
  decelerationRate: number; // RPM per second when releasing throttle
  sound: {
    baseWave: OscillatorType;
    harmonicMultipliers: number[];
    harmonicGains: number[];
    resonanceFrequency: number;
    resonanceQ: number;
    distortionAmount: number;
    mechanicalNoiseGain: number;
    turboWhistle: boolean;
    turboBaseFreq?: number;
    turboWhistleGain?: number;
  };
}

export const ENGINE_PRESETS: Record<string, EnginePreset> = {
  'v10-2004': {
    id: 'v10-2004',
    name: '2004 V10',
    tagline: 'F2004 风格 · 3.0L 自然吸气 · 高频金属撕裂音',
    cylinders: 10,
    idleRpm: 3500,
    redlineRpm: 19000,
    limiterRpm: 19200,
    accelerationRate: 36000,
    decelerationRate: 26000,
    sound: {
      baseWave: 'sawtooth',
      harmonicMultipliers: [1, 2, 3, 4, 5, 6, 7, 8],
      harmonicGains: [0.65, 0.45, 0.35, 0.25, 0.18, 0.12, 0.08, 0.05],
      resonanceFrequency: 1600,
      resonanceQ: 6.5,
      distortionAmount: 18,
      mechanicalNoiseGain: 0.12,
      turboWhistle: false
    }
  },
  'v8-2010': {
    id: 'v8-2010',
    name: '2010 V8',
    tagline: 'RB6 风格 · 2.4L 自然吸气 · 机械颗粒怒吼',
    cylinders: 8,
    idleRpm: 4000,
    redlineRpm: 18000,
    limiterRpm: 18200,
    accelerationRate: 32000,
    decelerationRate: 23000,
    sound: {
      baseWave: 'sawtooth',
      harmonicMultipliers: [1, 2, 3, 4, 5, 6],
      harmonicGains: [0.75, 0.55, 0.4, 0.28, 0.16, 0.09],
      resonanceFrequency: 1200,
      resonanceQ: 4.8,
      distortionAmount: 24,
      mechanicalNoiseGain: 0.16,
      turboWhistle: false
    }
  },
  'v6-2026': {
    id: 'v6-2026',
    name: '2026 V6 Turbo',
    tagline: '1.6L 涡轮增压混动 · 涡轮吹气哨音与现代重低音',
    cylinders: 6,
    idleRpm: 4000,
    redlineRpm: 15000,
    limiterRpm: 15200,
    accelerationRate: 28000,
    decelerationRate: 19000,
    sound: {
      baseWave: 'triangle',
      harmonicMultipliers: [1, 2, 3, 4, 5],
      harmonicGains: [0.8, 0.5, 0.35, 0.2, 0.1],
      resonanceFrequency: 950,
      resonanceQ: 3.8,
      distortionAmount: 12,
      mechanicalNoiseGain: 0.08,
      turboWhistle: true,
      turboBaseFreq: 2400,
      turboWhistleGain: 0.14
    }
  }
};

/**
 * 计算内燃机点火基频：
 * f = RPM * cylinders / 120 (4冲程每2转每个气缸点火1次)
 */
export function calculateFiringFrequency(rpm: number, cylinders: number): number {
  return Math.max(20, (rpm * cylinders) / 120);
}
