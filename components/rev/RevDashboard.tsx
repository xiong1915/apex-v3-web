// components/rev/RevDashboard.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ENGINE_PRESETS, EnginePreset } from '@/lib/audio/engine-presets';
import { RevPhysicsSimulator } from '@/lib/audio/rev-physics';
import { F1EngineSynthesizer } from '@/lib/audio/engine-synthesizer';
import { ShiftLights } from './ShiftLights';
import { Tachometer } from './Tachometer';
import { ThrottleControl } from './ThrottleControl';
import { ExhaustEffects } from './ExhaustEffects';
import styles from './rev.module.css';

export function RevDashboard() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('v10-2004');
  const currentPreset = ENGINE_PRESETS[selectedPresetId] || ENGINE_PRESETS['v10-2004'];

  const [isAudioStarted, setIsAudioStarted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.65);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // 物理与声学状态
  const [rpm, setRpm] = useState<number>(currentPreset.idleRpm);
  const [throttle, setThrottle] = useState<number>(0.0);
  const [isBackfiring, setIsBackfiring] = useState<boolean>(false);
  const [backfireCount, setBackfireCount] = useState<number>(0);
  const [audioEnergy, setAudioEnergy] = useState<number>(0);

  // 实例引用
  const synthRef = useRef<F1EngineSynthesizer | null>(null);
  const physicsRef = useRef<RevPhysicsSimulator | null>(null);
  const targetThrottleRef = useRef<number>(0.0);
  const lastTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // 1. 初始化物理模拟器
  useEffect(() => {
    physicsRef.current = new RevPhysicsSimulator(currentPreset);
    synthRef.current = new F1EngineSynthesizer(currentPreset);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (synthRef.current) synthRef.current.destroy();
    };
  }, []);

  // 2. 动画与物理帧驱动主循环
  const loop = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    if (physicsRef.current) {
      const state = physicsRef.current.step(dt, targetThrottleRef.current);
      setRpm(state.rpm);
      setThrottle(state.throttle);
      setIsBackfiring(state.isBackfiring);
      setBackfireCount(state.backfireCount);

      if (synthRef.current) {
        synthRef.current.updateSound(state.rpm, state.engineLoad, state.isLimiterActive);
        if (state.isBackfiring && Math.random() < 0.3) {
          synthRef.current.triggerBackfire();
        }
        setAudioEnergy(synthRef.current.getEnergy());
      }
    }

    animFrameRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [loop]);

  // 3. 启动引擎声音 (解锁 Web Audio API)
  const handleStartAudio = async () => {
    if (!synthRef.current) return;
    const ok = await synthRef.current.init();
    if (ok) {
      setIsAudioStarted(true);
    }
  };

  // 4. 切换引擎模式
  const handleSwitchPreset = async (presetId: string) => {
    const nextPreset = ENGINE_PRESETS[presetId];
    if (!nextPreset) return;
    setSelectedPresetId(presetId);

    if (physicsRef.current) {
      physicsRef.current.setPreset(nextPreset);
    }
    if (synthRef.current) {
      await synthRef.current.switchPreset(nextPreset);
    }
  };

  // 5. 改变油门输入
  const handleThrottleChange = (val: number) => {
    targetThrottleRef.current = val;
    // 如果尚未点击启动，按油门自动激活声音
    if (!isAudioStarted && val > 0) {
      handleStartAudio();
    }
  };

  // 6. 音量调节与静音
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (synthRef.current) synthRef.current.setVolume(val);
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (synthRef.current) synthRef.current.setMuted(nextMute);
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* 顶部控制栏 */}
      <header className={styles.topBar}>
        <div className={styles.brandGroup}>
          <span className={styles.brandIcon} aria-hidden="true">🔊</span>
          <div>
            <h1 className={styles.brandTitle}>Acoustic Rev</h1>
            <span className={styles.brandSubtitle}>F1 SOUND LAB · WEB AUDIO</span>
          </div>
        </div>

        {/* 引擎模式选择器 */}
        <div className={styles.presetSelector} role="radiogroup" aria-label="F1 引擎时代选择">
          {Object.values(ENGINE_PRESETS).map((p) => (
            <button
              key={p.id}
              className={`${styles.presetBtn} ${p.id === selectedPresetId ? styles.presetBtnActive : ''}`}
              onClick={() => handleSwitchPreset(p.id)}
              role="radio"
              aria-checked={p.id === selectedPresetId}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* 音量控制与返回 */}
        <div className={styles.topActions}>
          <div className={styles.volumeGroup}>
            <button
              className={styles.muteBtn}
              onClick={handleToggleMute}
              aria-label={isMuted ? '取消静音' : '静音'}
            >
              {isMuted ? '🔇' : '🔉'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className={styles.volumeSlider}
              aria-label="主音量"
            />
          </div>

          <Link href="/" className={styles.backHomeLink}>
            ← 返回首页
          </Link>
        </div>
      </header>

      {/* 核心驾驶舱液晶仪表主体 */}
      <main className={styles.cockpitPanel}>
        {/* 未解锁声音时的遮罩引导 */}
        {!isAudioStarted && (
          <div className={styles.startOverlay}>
            <button className={styles.startBtn} onClick={handleStartAudio}>
              <span>⚡ 启动引擎声浪系统</span>
            </button>
            <p className={styles.startNote}>
              点击激活原生 Web Audio 声学引擎，或直接按住下方油门踏板起跑
            </p>
          </div>
        )}

        {/* 15 颗换挡指示灯 */}
        <ShiftLights
          rpm={rpm}
          redlineRpm={currentPreset.redlineRpm}
          idleRpm={currentPreset.idleRpm}
        />

        {/* 弧形转速表盘 */}
        <Tachometer
          rpm={rpm}
          maxRpm={currentPreset.limiterRpm}
          redlineRpm={currentPreset.redlineRpm}
          idleRpm={currentPreset.idleRpm}
          engineName={currentPreset.tagline}
        />

        {/* 排气回火火花与低音震颤 */}
        <ExhaustEffects
          isBackfiring={isBackfiring}
          backfireCount={backfireCount}
          audioEnergy={audioEnergy}
          rpm={rpm}
        />

        {/* 踏板交互控件 */}
        <ThrottleControl
          throttle={throttle}
          onThrottleChange={handleThrottleChange}
        />
      </main>
    </div>
  );
}
