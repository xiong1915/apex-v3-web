// components/rev/RevDashboard.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ENGINE_PRESETS } from '@/lib/audio/engine-presets';
import { RevPhysicsSimulator } from '@/lib/audio/rev-physics';
import { F1EngineSynthesizer } from '@/lib/audio/engine-synthesizer';
import { ShiftLights } from './ShiftLights';
import { Tachometer } from './Tachometer';
import { ThrottleControl } from './ThrottleControl';
import { ExhaustEffects } from './ExhaustEffects';
import { ArcadeLobby, ArcadeMode } from './arcade/ArcadeLobby';
import { DragRaceView } from './arcade/DragRaceView';
import { LaunchControlView } from './arcade/LaunchControlView';
import { SoundQuizView } from './arcade/SoundQuizView';
import { AchievementsToast } from './arcade/AchievementsToast';
import { AchievementDef } from '@/lib/arcade/storage';
import styles from './rev.module.css';

export type EngineState = 'OFF' | 'STARTING' | 'RUNNING' | 'STOPPING';

export function RevDashboard() {
  // 顶层模式切换: 默认进入直线加速赛或大厅，这里默认大厅以展现全新 Arcade 2.0 体验
  const [activeMode, setActiveMode] = useState<ArcadeMode>('DRAG');
  const [activeAchievement, setActiveAchievement] = useState<AchievementDef | null>(null);

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

  // 2. 动画与物理帧驱动主循环 (仅在 FREE 自由轰油门模式下运转)
  const loop = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    const physics = physicsRef.current;
    const synth = synthRef.current;

    if (physics && activeMode === 'FREE') {
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
  }, [activeMode]);

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
    if (e) (e.currentTarget as HTMLElement).blur();
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

  // 8. 模式切换处理
  const handleSelectMode = (newMode: ArcadeMode) => {
    setActiveMode(newMode);
    // 从其他模式切回自由声浪时，如果处于未启动状态，提示用户
    if (newMode !== 'FREE') {
      targetThrottleRef.current = 0;
      if (physicsRef.current) {
        physicsRef.current.setIgnited(false);
      }
      setEngineState('OFF');
      setRpmDisplay(0);
      setThrottleDisplay(0);
      setIsBackfiring(false);
    }
  };

  // 9. 解锁成就回调
  const handleUnlockAchievement = (ach: AchievementDef) => {
    setActiveAchievement(ach);
  };

  // 10. 页面后台生命周期管理
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const synth = synthRef.current;
      const physics = physicsRef.current;

      if (document.hidden) {
        if (engineState === 'RUNNING') {
          wasRunningBeforeHiddenRef.current = true;
          targetThrottleRef.current = 0;
          if (synth) await synth.fadeAndSuspend(40);
        }
      } else {
        if (wasRunningBeforeHiddenRef.current && engineState === 'RUNNING') {
          wasRunningBeforeHiddenRef.current = false;
          targetThrottleRef.current = 0;
          if (synth) await synth.resumeAndFadeIn(80);
          if (physics) physics.reset();
        }
      }
    };

    const handleWindowBlur = () => {
      targetThrottleRef.current = 0;
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
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
          <span className={styles.brandIcon} aria-hidden="true">🏎️</span>
          <div>
            <h1 className={styles.brandTitle}>Acoustic Rev Arcade</h1>
            <span className={styles.brandSubtitle}>F1 SOUND LAB · V2.0 ARCADE</span>
          </div>
        </div>

        {/* Arcade 模式选择标签组 */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md overflow-x-auto max-w-full">
          <button
            onClick={() => handleSelectMode('LOBBY')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer ${
              activeMode === 'LOBBY'
                ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            🏛️ 大厅
          </button>
          <button
            onClick={() => handleSelectMode('DRAG')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer ${
              activeMode === 'DRAG'
                ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            🏁 直线加速赛
          </button>
          <button
            onClick={() => handleSelectMode('LAUNCH')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer ${
              activeMode === 'LAUNCH'
                ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            🎯 弹射起步
          </button>
          <button
            onClick={() => handleSelectMode('QUIZ')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer ${
              activeMode === 'QUIZ'
                ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            🎧 听声辨引擎
          </button>
          <button
            onClick={() => handleSelectMode('FREE')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer ${
              activeMode === 'FREE'
                ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            🔊 自由声浪
          </button>
        </div>

        {/* 启停按键、音量与返回 */}
        <div className={styles.topActions}>
          {activeMode === 'FREE' && (
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
          )}

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

      {/* 视图主体根据当前模式条件渲染 */}
      <main className="w-full py-4 sm:py-6 flex flex-col items-center">
        {activeMode === 'LOBBY' && (
          <ArcadeLobby onSelectMode={handleSelectMode} />
        )}

        {activeMode === 'DRAG' && (
          <DragRaceView
            synth={synthRef.current}
            onUnlockAchievement={handleUnlockAchievement}
            onExitToLobby={() => handleSelectMode('LOBBY')}
          />
        )}

        {activeMode === 'LAUNCH' && (
          <LaunchControlView
            synth={synthRef.current}
            onUnlockAchievement={handleUnlockAchievement}
            onExitToLobby={() => handleSelectMode('LOBBY')}
          />
        )}

        {activeMode === 'QUIZ' && (
          <SoundQuizView
            synth={synthRef.current}
            onUnlockAchievement={handleUnlockAchievement}
            onExitToLobby={() => handleSelectMode('LOBBY')}
          />
        )}

        {activeMode === 'FREE' && (
          <div className={styles.cockpitPanel}>
            {/* 引擎模式选择器 */}
            <div className={`${styles.presetSelector} mb-4`} role="radiogroup" aria-label="F1 引擎时代选择">
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

            {!isEngineRunning && (
              <div className={styles.standbyBanner}>
                <span>⚠️ 引擎已熄火 · 点击上方 START ENGINE 或踩下踏板点火</span>
              </div>
            )}

            <ShiftLights
              rpm={rpmDisplay}
              redlineRpm={currentPreset.redlineRpm}
              idleRpm={currentPreset.idleRpm}
            />

            <Tachometer
              rpm={rpmDisplay}
              maxRpm={currentPreset.limiterRpm}
              redlineRpm={currentPreset.redlineRpm}
              idleRpm={currentPreset.idleRpm}
              engineName={currentPreset.tagline}
            />

            <ExhaustEffects
              isBackfiring={isBackfiring}
              backfireCount={backfireCount}
              audioEnergy={audioEnergy}
              rpm={rpmDisplay}
            />

            <ThrottleControl
              throttle={throttleDisplay}
              onThrottleChange={handleThrottleChange}
              disabled={!isEngineRunning && engineState !== 'STARTING'}
            />
          </div>
        )}
      </main>

      {/* 成就解锁弹窗 */}
      <AchievementsToast
        achievement={activeAchievement}
        onClose={() => setActiveAchievement(null)}
      />
    </div>
  );
}
