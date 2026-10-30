// lib/audio/engine-synthesizer.ts
// APEX V3 Acoustic Rev — Pure Web Audio API Engine Sound Synthesizer

import { EnginePreset, calculateFiringFrequency } from './engine-presets';

export class F1EngineSynthesizer {
  private ctx: AudioContext | null = null;
  private preset: EnginePreset;
  private isRunning: boolean = false;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // 谐波振荡器网络
  private harmonicOscs: OscillatorNode[] = [];
  private harmonicGains: GainNode[] = [];
  private waveShaper: WaveShaperNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;

  // 进气与机械摩擦白噪声
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;

  // 涡轮增压哨音 (V6)
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;

  // 音量与静音状态 (独立持久化)
  private volume: number = 0.65;
  private isMuted: boolean = false;

  constructor(initialPreset: EnginePreset) {
    this.preset = initialPreset;
  }

  /**
   * 初始化音频上下文（必须在用户手势/点击事件中调用）
   */
  public async init(): Promise<boolean> {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.isRunning = true;
      return true;
    }

    try {
      if (typeof window === 'undefined') return false;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      this.ctx = new AudioCtx({ latencyHint: 'interactive' });

      // 1. 主输出总线与压限器 (避免任何情况下的数字爆音与削波)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(20, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // 2. 建立声学生成网络
      this.buildAudioGraph();

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.isRunning = true;
      return true;
    } catch (err) {
      console.warn('[F1EngineSynthesizer] AudioContext init failed:', err);
      return false;
    }
  }

  /**
   * 建立振荡器与滤波器拓扑结构
   */
  private buildAudioGraph(): void {
    if (!this.ctx || !this.masterGain) return;

    this.cleanupGraphNodes();

    const now = this.ctx.currentTime;
    const soundSpec = this.preset.sound;

    // 1. 波形失真塑形 (模拟内燃机气缸点火的非线性爆炸冲击)
    this.waveShaper = this.ctx.createWaveShaper();
    this.waveShaper.curve = this.makeDistortionCurve(soundSpec.distortionAmount) as any;
    this.waveShaper.oversample = '2x';

    // 2. 排气共振腔滤波器 (Bandpass)
    this.exhaustFilter = this.ctx.createBiquadFilter();
    this.exhaustFilter.type = 'bandpass';
    this.exhaustFilter.frequency.setValueAtTime(soundSpec.resonanceFrequency, now);
    this.exhaustFilter.Q.setValueAtTime(soundSpec.resonanceQ, now);

    this.waveShaper.connect(this.exhaustFilter);
    this.exhaustFilter.connect(this.masterGain);

    // 3. 谐波振荡器网络
    this.harmonicOscs = [];
    this.harmonicGains = [];
    const baseFreq = calculateFiringFrequency(this.preset.idleRpm, this.preset.cylinders);

    soundSpec.harmonicMultipliers.forEach((mult, index) => {
      if (!this.ctx || !this.waveShaper) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = soundSpec.baseWave;
      osc.frequency.setValueAtTime(baseFreq * mult, now);

      const nominalGain = (soundSpec.harmonicGains[index] || 0.1) * 0.25;
      gain.gain.setValueAtTime(nominalGain, now);

      osc.connect(gain);
      gain.connect(this.waveShaper);

      osc.start();
      this.harmonicOscs.push(osc);
      this.harmonicGains.push(gain);
    });

    // 4. 进气白噪声 (模拟气流高速摩擦与进气啸叫)
    this.buildNoiseLayer();

    // 5. 涡轮增压高频哨音 (V6 特有)
    if (soundSpec.turboWhistle && soundSpec.turboBaseFreq) {
      this.turboOsc = this.ctx.createOscillator();
      this.turboGain = this.ctx.createGain();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.setValueAtTime(soundSpec.turboBaseFreq, now);
      this.turboGain.gain.setValueAtTime(0, now); // 初始怠速微弱

      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);
      this.turboOsc.start();
    }
  }

  /**
   * 生成白噪声缓冲并带通滤波
   */
  private buildNoiseLayer(): void {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 2; // 2秒循环白噪声
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.setValueAtTime(2400, this.ctx.currentTime);
    this.noiseFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.setValueAtTime(this.preset.sound.mechanicalNoiseGain * 0.15, this.ctx.currentTime);

    this.noiseNode.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);
    this.noiseNode.start();
  }

  /**
   * 实时根据物理引擎更新声学输出参数
   * @param rpm 当前转速
   * @param load 发动机负载 (0~1)
   * @param isLimiter 是否处于断油限制
   */
  public updateSound(rpm: number, load: number, isLimiter: boolean): void {
    if (!this.ctx || !this.isRunning) return;

    const now = this.ctx.currentTime;
    const baseFreq = calculateFiringFrequency(rpm, this.preset.cylinders);
    const soundSpec = this.preset.sound;

    // 1. 更新所有点火谐波基频与音量
    this.harmonicOscs.forEach((osc, i) => {
      const mult = soundSpec.harmonicMultipliers[i] || (i + 1);
      let targetFreq = baseFreq * mult;

      // 断油时产生瞬间微颤音
      if (isLimiter) {
        targetFreq += (Math.random() - 0.5) * 60;
      }
      osc.frequency.setTargetAtTime(targetFreq, now, 0.02);
    });

    // 2. 排气共振中心频率随转速动态上移 (转速越高气流越急，共振频偏越高)
    if (this.exhaustFilter) {
      const targetResonance = soundSpec.resonanceFrequency + (rpm / this.preset.redlineRpm) * 1200;
      this.exhaustFilter.frequency.setTargetAtTime(targetResonance, now, 0.03);
    }

    // 3. 机械噪声随转速和负载增大
    if (this.noiseGain && this.noiseFilter) {
      const targetNoise = soundSpec.mechanicalNoiseGain * (0.05 + 0.25 * load);
      this.noiseGain.gain.setTargetAtTime(targetNoise, now, 0.04);
      this.noiseFilter.frequency.setTargetAtTime(1800 + load * 2000, now, 0.04);
    }

    // 4. 涡轮哨音跟随转速飙升 (仅 V6)
    if (this.turboOsc && this.turboGain && soundSpec.turboBaseFreq) {
      const turboFreq = soundSpec.turboBaseFreq + (rpm / this.preset.redlineRpm) * 3800;
      const turboVol = (soundSpec.turboWhistleGain || 0.1) * Math.pow(load, 1.4);
      this.turboOsc.frequency.setTargetAtTime(turboFreq, now, 0.03);
      this.turboGain.gain.setTargetAtTime(turboVol, now, 0.04);
    }
  }

  /**
   * 触发松油门排气管回火放炮 (Backfire Pop)
   */
  public triggerBackfire(): void {
    if (!this.ctx || !this.masterGain || this.isMuted || !this.isRunning) return;

    const now = this.ctx.currentTime;
    // 采用衰减脉冲噪音模拟瞬态爆鸣
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08); // 80ms 瞬态短爆
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.exp(-i / (bufferSize * 0.25));
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const popSource = this.ctx.createBufferSource();
    popSource.buffer = buffer;

    const popFilter = this.ctx.createBiquadFilter();
    popFilter.type = 'lowpass';
    popFilter.frequency.setValueAtTime(800 + Math.random() * 400, now);

    const popGain = this.ctx.createGain();
    popGain.gain.setValueAtTime(0.45, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    popSource.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(this.masterGain);

    popSource.onended = () => {
      popSource.disconnect();
      popFilter.disconnect();
      popGain.disconnect();
    };

    popSource.start(now);
    popSource.stop(now + 0.08);
  }

  /**
   * 切换引擎模式 (平滑交叉淡化)
   */
  public async switchPreset(newPreset: EnginePreset): Promise<void> {
    if (this.preset.id === newPreset.id) return;
    this.preset = newPreset;

    if (this.ctx && this.isRunning) {
      const now = this.ctx.currentTime;
      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, now);
        this.masterGain.gain.linearRampToValueAtTime(0.001, now + 0.04);
      }

      await new Promise(r => setTimeout(r, 45));
      this.buildAudioGraph();

      if (this.masterGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.volume, t + 0.06);
      }
    }
  }

  /**
   * 获取瞬时声学能量 (供液态玻璃气浪与抖动使用，返回 0.0 ~ 1.0)
   */
  public getEnergy(): number {
    if (!this.analyser || !this.isRunning) return 0;
    const array = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(array);
    let sum = 0;
    for (let i = 0; i < array.length; i++) {
      sum += array[i];
    }
    return sum / (array.length * 255);
  }

  public readSpectrum(target: Uint8Array<ArrayBuffer>): void {
    if (this.analyser && this.isRunning) this.analyser.getByteFrequencyData(target);
    else target.fill(0);
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && !this.isMuted && this.isRunning) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx && this.isRunning) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 平滑淡出并暂停 (熄火 / 页面隐藏切后台)
   */
  public async fadeAndSuspend(durationMs: number = 60): Promise<void> {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.isRunning = false;
      return;
    }

    if (this.masterGain && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      const durSec = durationMs / 1000;
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + durSec);
      await new Promise(r => setTimeout(r, durationMs + 10));
    }

    if (this.ctx && this.ctx.state === 'running') {
      try {
        await this.ctx.suspend();
      } catch (_) {}
    }
    this.isRunning = false;
  }

  /**
   * 恢复并平滑淡入 (启动 / 页面重新获得焦点)
   */
  public async resumeAndFadeIn(durationMs: number = 80): Promise<boolean> {
    if (!this.ctx || this.ctx.state === 'closed') {
      return await this.init();
    }

    try {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.isRunning = true;

      if (this.masterGain) {
        const now = this.ctx.currentTime;
        const durSec = durationMs / 1000;
        this.masterGain.gain.setValueAtTime(0.0001, now);
        this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.volume, now + durSec);
      }
      return true;
    } catch (err) {
      console.warn('[F1EngineSynthesizer] resume failed:', err);
      return false;
    }
  }

  public suspend(): void {
    this.fadeAndSuspend(40);
  }

  public resume(): void {
    this.resumeAndFadeIn(60);
  }

  public destroy(): void {
    this.cleanupGraphNodes();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch (_) {}
    }
    this.ctx = null;
    this.isRunning = false;
  }

  private cleanupGraphNodes(): void {
    this.harmonicOscs.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (_) {}
    });
    this.harmonicOscs = [];
    this.harmonicGains.forEach(gain => {
      try {
        gain.disconnect();
      } catch (_) {}
    });
    this.harmonicGains = [];

    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch (_) {}
      this.noiseNode = null;
    }
    if (this.turboOsc) {
      try {
        this.turboOsc.stop();
        this.turboOsc.disconnect();
      } catch (_) {}
      this.turboOsc = null;
    }
  }

  /**
   * 生成 S 型非线性软饱和曲线
   */
  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}
