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

export type EngineState = 'OFF' | 'STARTING' | 'RUNNING' | 'STOPPING';

export function RevDashboard() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('v10-2004');
  const currentPreset = ENGINE_PRESETS[selectedPresetId] || ENGINE_PRESETS['v10-2004'];

  // 引擎启停状态机
  const [engineState, setEngineState] = useState<EngineState>('OFF');

  // 音量与静音状态 (独立持久化)
  const [volume, setVolume] = useState<number>(0.65);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // 驱动 UI 渲染的平滑状态 (限制节流更新)
  const [rpmDisplay, setRpmDisplay] = useState<number>(0);
  const [throttleDisplay, setThrottleDisplay] = useState<number>(0.0);
  const [isBackfiring, setIsBackfiring] = useState<boolean>(false);
  const [backfireCount, setBackfireCount] = useState<number>(0);
  const [audioEnergy, setAudioEnergy] = useState<number>(0);

  // 实例与高频计算引用
  const synthRef = useRef<F1EngineSynthesizer | null>(null);
  const physicsRef = useRef<RevPhysicsSimulator | null>(null);
  const targetThrottleRef = useRef<number>(0.0);
  const lastTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // 页面切后台恢复标记
  const wasRunningBeforeHiddenRef = useRef<boolean>(false);
  // 节流刷新计时器
  const lastUiUpdateRef = useRef<number>(0);

  // 1. 初始化物理模拟器与声学合成器
  useEffect(() => {
    const physics = new RevPhysicsSimulator(currentPreset, false);
    const synth = new F1EngineSynthesizer(currentPreset);
    synth.setVolume(volume);
    synth.setMuted(isMuted);

    physicsRef.current = physics;
    synthRef.current = synth;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (synthRef.current) synthRef.current.destroy();
    };
  }, []);

  // 2. 动画与物理帧驱动主循环 (高频纯物理计算，低频节流 React 渲染)
  const loop = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    const physics = physicsRef.current;
    const synth = synthRef.current;

    if (physics) {
      const state = physics.step(dt, targetThrottleRef.current);

      if (synth && synth.getIsRunning()) {
        synth.updateSound(state.rpm, state.engineLoad, state.isLimiterActive);
        if (state.isBackfiring && Math.random() < 0.3) {
          synth.triggerBackfire();
        }
      }

      // UI 状态节流更新 (约 15Hz ~ 20Hz 更新一次 React State，降低主线程负载 80%)
      if (timestamp - lastUiUpdateRef.current >= 50) {
        lastUiUpdateRef.current = timestamp;
        setRpmDisplay(state.rpm);
        setThrottleDisplay(state.throttle);
        setIsBackfiring(state.isBackfiring);
        setBackfireCount(state.backfireCount);
        if (synth && synth.getIsRunning()) {
          setAudioEnergy(synth.getEnergy());
        } else {
          setAudioEnergy(0);
        }
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

  // 3. 启动引擎 (手势解锁并平滑起动)
  const handleStartEngine = async () => {
    if (engineState === 'STARTING' || engineState === 'RUNNING') return;
    setEngineState('STARTING');

    const synth = synthRef.current;
    const physics = physicsRef.current;

    if (synth) {
      synth.setVolume(volume);
      synth.setMuted(isMuted);
      const ok = await synth.resumeAndFadeIn(80);
      if (!ok) {
        setEngineState('OFF');
        return;
      }
    }

    if (physics) {
      physics.setIgnited(true);
    }
    setEngineState('RUNNING');
  };

  // 4. 熄火引擎 (快速平滑淡出，释放油门并归零转速)
  const handleStopEngine = async () => {
    if (engineState === 'OFF' || engineState === 'STOPPING') return;
    setEngineState('STOPPING');
    targetThrottleRef.current = 0.0;

    const physics = physicsRef.current;
    const synth = synthRef.current;

    if (physics) {
      physics.setIgnited(false);
    }

    if (synth) {
      await synth.fadeAndSuspend(80);
    }

    setEngineState('OFF');
    setRpmDisplay(0);
    setThrottleDisplay(0);
    setIsBackfiring(false);
    setAudioEnergy(0);
  };

  // 5. 切换引擎模式 (保持已有音量与启停状态)
  const handleSwitchPreset = async (presetId: string, e?: React.MouseEvent) => {
    if (e) (e.currentTarget as HTMLElement).blur(); // 释放按键焦点，避免 Space 误触发
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

  // 6. 油门踏板输入通知 (稳定引用)
  const handleThrottleChange = useCallback((val: number) => {
    targetThrottleRef.current = val;
    // 如果尚未点火但处于 OFF，踩油门可自动点火启动
    setEngineState(current => {
      if (current === 'OFF' && val > 0) {
        handleStartEngine();
      }
      return current;
    });
  }, []);

  // 7. 音量与静音独立控制
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (synthRef.current) {
      synthRef.current.setVolume(val);
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).blur();
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (synthRef.current) {
      synthRef.current.setMuted(nextMute);
    }
  };

  // 8. 页面后台生命周期管理 (切后台暂停音频，防卡顿与噪音)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const synth = synthRef.current;
      const physics = physicsRef.current;

      if (document.hidden) {
        // 切后台
        if (engineState === 'RUNNING') {
          wasRunningBeforeHiddenRef.current = true;
          targetThrottleRef.current = 0;
          if (synth) await synth.fadeAndSuspend(40);
        }
      } else {
        // 恢复前台
        if (wasRunningBeforeHiddenRef.current && engineState === 'RUNNING') {
          wasRunningBeforeHiddenRef.current = false;
          targetThrottleRef.current = 0; // 安全怠速，绝不轰油门
          if (synth) await synth.resumeAndFadeIn(80);
          if (physics) physics.reset();
        }
      }
    };

    const handleWindowBlur = () => {
      targetThrottleRef.current = 0;
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Escape 紧急熄火与安全释放
      if (e.code === 'Escape') {
        const target = e.target as HTMLElement;
        if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        if (engineState === 'RUNNING') {
          handleStopEngine();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [engineState]);

  const isEngineRunning = engineState === 'RUNNING';

  return (
    <div className={styles.dashboardContainer}>
      {/* 顶部控制栏 */}
      <header className={styles.topBar}>
        <div className={styles.brandGroup}>
          <span className={styles.brandIcon} aria-hidden="true">🔊</span>
          <div>
            <h1 className={styles.brandTitle}>Acoustic Rev</h1>
            <span className={styles.brandSubtitle}>F1 SOUND LAB · V1.1</span>
          </div>
        </div>

        {/* 引擎模式选择器 */}
        <div className={styles.presetSelector} role="radiogroup" aria-label="F1 引擎时代选择">
          {Object.values(ENGINE_PRESETS).map((p) => (
            <button
              key={p.id}
              className={`${styles.presetBtn} ${p.id === selectedPresetId ? styles.presetBtnActive : ''}`}
              onClick={(e) => handleSwitchPreset(p.id, e)}
              role="radio"
              aria-checked={p.id === selectedPresetId}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* 启停按键、音量与返回 */}
        <div className={styles.topActions}>
          {/* 核心双态启停控制 */}
          <button
            type="button"
            className={`${styles.engineControlBtn} ${isEngineRunning ? styles.btnRunning : styles.btnOff}`}
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              if (isEngineRunning) {
                handleStopEngine();
              } else {
                handleStartEngine();
              }
            }}
            aria-label={isEngineRunning ? '熄火引擎' : '启动引擎'}
          >
            <span className={styles.engineBtnLed} aria-hidden="true" />
            <span>
              {engineState === 'STARTING'
                ? 'IGNITING...'
                : engineState === 'STOPPING'
                ? 'STOPPING...'
                : isEngineRunning
                ? 'STOP ENGINE'
                : 'START ENGINE'}
            </span>
          </button>

          {/* 音量与静音 */}
          <div className={styles.volumeGroup}>
            <button
              type="button"
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
              value={volume}
              disabled={isMuted}
              onChange={handleVolumeChange}
              className={`${styles.volumeSlider} ${isMuted ? styles.sliderMuted : ''}`}
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
        {/* 未点火启动时的待机状态条 */}
        {!isEngineRunning && (
          <div className={styles.standbyBanner}>
            <span>⚠️ 引擎已熄火 · 点击上方 START ENGINE 或踩下踏板点火</span>
          </div>
        )}

        {/* 15 颗换挡指示灯 */}
        <ShiftLights
          rpm={rpmDisplay}
          redlineRpm={currentPreset.redlineRpm}
          idleRpm={currentPreset.idleRpm}
        />

        {/* 弧形转速表盘 */}
        <Tachometer
          rpm={rpmDisplay}
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
          rpm={rpmDisplay}
        />

        {/* 踏板交互控件 */}
        <ThrottleControl
          throttle={throttleDisplay}
          onThrottleChange={handleThrottleChange}
          disabled={!isEngineRunning && engineState !== 'STARTING'}
        />
      </main>
    </div>
  );
}
