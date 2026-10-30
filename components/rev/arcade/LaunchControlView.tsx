'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

import { CAR_SPECS, CarSpec } from '@/lib/arcade/car-specs';
import { DragPhysicsEngine, DragRaceTelemetry } from '@/lib/arcade/drag-physics';
import { F1EngineSynthesizer } from '@/lib/audio/engine-synthesizer';
import { F1StartLights, StartLightState } from './F1StartLights';
import { AchievementDef, tryUnlockAchievement } from '@/lib/arcade/storage';

interface LaunchControlViewProps {
  synth: F1EngineSynthesizer | null;
  onUnlockAchievement: (ach: AchievementDef) => void;
  onExitToLobby: () => void;
}

export function LaunchControlView({
  synth,
  onUnlockAchievement,
  onExitToLobby
}: LaunchControlViewProps) {
  const [selectedCarId, setSelectedCarId] = useState<'v10-2004' | 'v8-2010' | 'v6-2026'>('v10-2004');
  const spec = CAR_SPECS[selectedCarId];

  const engineRef = useRef<DragPhysicsEngine>(new DragPhysicsEngine(spec));

  // 阶段状态: 'STABILIZE' (维持绿区) -> 'COUNTDOWN' (五盏灯) -> 'SPRINT' (冲刺100m) -> 'EVALUATED' (结算)
  const [stage, setStage] = useState<'STABILIZE' | 'COUNTDOWN' | 'SPRINT' | 'EVALUATED'>('STABILIZE');
  const [lightStage, setLightStage] = useState<StartLightState>('OFF');
  const [lightCount, setLightCount] = useState<number>(0);

  // 绿区稳定计时 (需要连续保持 1.8 秒)
  const [stableTimeSec, setStableTimeSec] = useState<number>(0);
  const stableTargetSec = 1.8;

  // 反应时间与冲刺成绩
  const lightsOutTimeRef = useRef<number | null>(null);
  const [reactionTimeMs, setReactionTimeMs] = useState<number | null>(null);
  const [isJumpStart, setIsJumpStart] = useState<boolean>(false);
  const [launchQuality, setLaunchQuality] = useState<'PERFECT' | 'GOOD' | 'WHEEL_SPIN' | 'BOG_DOWN' | null>(null);
  const [time100m, setTime100m] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);

  // 遥测
  const [telemetry, setTelemetry] = useState<DragRaceTelemetry>(() => ({
    speedKmh: 0,
    speedMs: 0,
    distanceM: 0,
    rpm: spec.enginePreset.idleRpm,
    gear: 0,
    accelerationG: 0,
    isWheelSpinning: false,
    isLimiterActive: false,
    shiftInterruption: false,
    lastShiftQuality: 'NONE',
    perfectShiftCount: 0,
    time0To100: null,
    time0To200: null,
    time400m: null,
    trapSpeedKmh: null,
    isFinished: false
  }));

  // 输入状态
  const keyStateRef = useRef<{ space: boolean; keyW: boolean; touch: number }>({
    space: false,
    keyW: false,
    touch: 0
  });

  // 切换车型
  const handleSelectCar = (carId: 'v10-2004' | 'v8-2010' | 'v6-2026') => {
    if (stage === 'COUNTDOWN' || stage === 'SPRINT') return;
    setSelectedCarId(carId);
    const newSpec = CAR_SPECS[carId];
    engineRef.current.reset(newSpec);
    if (synth) synth.switchPreset(newSpec.enginePreset);
    handleReset();
  };

  // 重置挑战
  const handleReset = useCallback(() => {
    engineRef.current.reset(CAR_SPECS[selectedCarId]);
    setStage('STABILIZE');
    setLightStage('OFF');
    setLightCount(0);
    setStableTimeSec(0);
    lightsOutTimeRef.current = null;
    setReactionTimeMs(null);
    setIsJumpStart(false);
    setLaunchQuality(null);
    setTime100m(null);
    setScore(null);
  }, [selectedCarId]);

  // 触发灭灯发车
  const handleLaunch = useCallback(() => {
    const now = performance.now();

    if (stage === 'COUNTDOWN') {
      if (lightStage === 'SEQUENCE' || lightStage === 'HOLD') {
        // 抢跑
        setLightStage('JUMP_START');
        setIsJumpStart(true);
        setStage('SPRINT');
        engineRef.current.launch();
        return;
      }
    }

    if (lightsOutTimeRef.current) {
      const rx = Math.round(now - lightsOutTimeRef.current);
      setReactionTimeMs(rx);
      const { quality } = engineRef.current.launch();
      setLaunchQuality(quality);
      setStage('SPRINT');

      if (quality === 'PERFECT' && rx <= 200) {
        const ach = tryUnlockAchievement('perfect_launcher');
        if (ach) onUnlockAchievement(ach);
      }
    }
  }, [stage, lightStage, onUnlockAchievement]);

  // 键盘与输入监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        keyStateRef.current.space = true;
        if (synth) synth.init();
        if (stage === 'COUNTDOWN' && lightStage === 'LIGHTS_OUT') {
          handleLaunch();
        }
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        keyStateRef.current.keyW = true;
        if (synth) synth.init();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        if (stage === 'COUNTDOWN') {
          handleLaunch();
        } else if (stage === 'SPRINT') {
          engineRef.current.shiftUp();
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleReset();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        keyStateRef.current.space = false;
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        keyStateRef.current.keyW = false;
      }
    };

    const handleBlur = () => {
      keyStateRef.current.space = false;
      keyStateRef.current.keyW = false;
      keyStateRef.current.touch = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [stage, lightStage, handleLaunch, handleReset, synth]);

  // 主物理与状态机循环
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let sprintStartTime = 0;

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const k = keyStateRef.current;
      const keyThrottle = (k.space ? 1.0 : 0.0) || (k.keyW ? 1.0 : 0.0);
      const throttle = Math.max(keyThrottle, k.touch);

      const isSprint = stage === 'SPRINT';
      const telem = engineRef.current.step(dt, throttle, isSprint);
      setTelemetry(telem);

      if (synth) {
        synth.updateSound(telem.rpm, throttle, telem.isLimiterActive);
      }

      // 阶段 1: 稳定在绿区
      if (stage === 'STABILIZE') {
        const inWindow = telem.rpm >= spec.launchRpmMin && telem.rpm <= spec.launchRpmMax;
        if (inWindow) {
          setStableTimeSec((prev) => {
            const next = prev + dt;
            if (next >= stableTargetSec) {
              // 绿区稳定达成，开启倒计时发车
              setStage('COUNTDOWN');
              setLightStage('SEQUENCE');
              setLightCount(1);
              let c = 1;
              const seq = setInterval(() => {
                c++;
                if (c <= 5) {
                  setLightCount(c);
                } else {
                  clearInterval(seq);
                  setLightStage('HOLD');
                  setTimeout(() => {
                    lightsOutTimeRef.current = performance.now();
                    setLightStage('LIGHTS_OUT');
                  }, 800 + Math.random() * 1200);
                }
              }, 800);
            }
            return next;
          });
        } else {
          setStableTimeSec(0);
        }
      }

      // 阶段 3: 100 米冲刺与自动升挡
      if (stage === 'SPRINT') {
        if (!sprintStartTime) sprintStartTime = currentTime;
        // 自动升挡以保证最佳 100 米成绩
        if (telem.rpm >= spec.optimalShiftRpmMin && telem.gear < spec.totalGears) {
          engineRef.current.shiftUp();
        }

        // 冲过 100 米
        if (telem.distanceM >= 100 && stage === 'SPRINT') {
          setStage('EVALUATED');
          const elapsed100 = (currentTime - sprintStartTime) / 1000;
          setTime100m(elapsed100);

          // 计算总分 (0~100 分)
          let baseScore = 95;
          const rx = reactionTimeMs || 300;
          if (rx < 200) baseScore += 5;
          else if (rx > 350) baseScore -= Math.min(25, (rx - 350) / 10);

          if (isJumpStart) baseScore = 20;
          else if (launchQuality === 'PERFECT') baseScore = Math.min(100, baseScore + 2);
          else if (launchQuality === 'WHEEL_SPIN') baseScore -= 10;
          else if (launchQuality === 'BOG_DOWN') baseScore -= 15;

          setScore(Math.max(10, Math.round(baseScore)));
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [stage, selectedCarId, spec, isJumpStart, reactionTimeMs, launchQuality, synth]);

  const isRpmInWindow = telemetry.rpm >= spec.launchRpmMin && telemetry.rpm <= spec.launchRpmMax;
  const stableProgress = Math.min(100, (stableTimeSec / stableTargetSec) * 100);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-5 animate-in fade-in duration-300">
      {/* 顶部车型选择 */}
      <div className="w-full flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-950/80 border border-white/10 backdrop-blur-md">
          {(['v10-2004', 'v8-2010', 'v6-2026'] as const).map((id) => (
            <button
              key={id}
              disabled={stage === 'COUNTDOWN' || stage === 'SPRINT'}
              onClick={() => handleSelectCar(id)}
              className={`px-3 sm:px-4 py-1.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                selectedCarId === id
                  ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 disabled:opacity-40'
              }`}
            >
              {CAR_SPECS[id].shortName}
            </button>
          ))}
        </div>

        <button
          onClick={onExitToLobby}
          className="text-xs font-mono text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer"
        >
          ← 返回大厅
        </button>
      </div>

      {/* 发车灯 */}
      <F1StartLights
        stage={lightStage}
        activeCount={lightCount}
        reactionTimeMs={reactionTimeMs}
        className="w-full"
      />

      {/* 核心挑战仪表盘 */}
      <div style={{ background: 'rgba(15, 17, 23, 0.96)' }}
        className="relative w-full p-6 sm:p-8 rounded-3xl border border-white/15 bg-zinc-950/85 shadow-2xl backdrop-blur-2xl text-white flex flex-col items-center"
      >
        <div className="text-xs font-mono tracking-widest text-zinc-400 uppercase mb-2">
          LAUNCH CONTROL · 弹射起步挑战
        </div>

        {/* 状态引导文案 */}
        <div className="h-8 flex items-center justify-center font-mono text-sm font-semibold">
          {stage === 'STABILIZE' && (
            <span className={isRpmInWindow ? 'text-emerald-400' : 'text-zinc-400'}>
              {isRpmInWindow
                ? `保持在绿区稳定中... (${stableTimeSec.toFixed(1)}s / ${stableTargetSec}s)`
                : `控制油门至弹射绿区: [${spec.launchRpmMin} ~ ${spec.launchRpmMax} RPM]`}
            </span>
          )}
          {stage === 'COUNTDOWN' && (
            <span className="text-amber-400 animate-pulse">
              {lightStage === 'LIGHTS_OUT' ? '⚡ 瞬间释放离合发车！(按 Space / 按钮)' : '保持专注，等待灭灯！'}
            </span>
          )}
          {stage === 'SPRINT' && (
            <span className="text-rose-400 font-bold tracking-wider">
              🔥 100 米全速冲刺中: {telemetry.distanceM.toFixed(1)}m
            </span>
          )}
          {stage === 'EVALUATED' && (
            <span className="text-emerald-300 font-bold">🎯 挑战完成</span>
          )}
        </div>

        {/* 绿区蓄力环形/进度指示 */}
        <div className="w-full max-w-md my-4">
          <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1">
            <span>稳定度积累</span>
            <span className="font-bold text-white">{Math.round(stableProgress)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-75 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              style={{ width: `${stableProgress}%` }}
            />
          </div>
        </div>

        {/* 转速大字与绿区高亮指示 */}
        <div className="flex flex-col items-center my-3">
          <div
            className={`text-6xl sm:text-7xl font-mono font-black transition-colors ${
              isRpmInWindow
                ? 'text-emerald-400 drop-shadow-[0_0_24px_rgba(52,211,153,0.5)]'
                : 'text-zinc-200'
            }`}
          >
            {telemetry.rpm.toLocaleString()}
          </div>
          <div className="text-xs font-mono text-zinc-400 mt-1">
            最佳绿区: <span className="text-emerald-400 font-bold">{spec.launchRpmMin} - {spec.launchRpmMax}</span> RPM
          </div>
        </div>

        {/* 结算指标卡片 (仅在 EVALUATED 显示) */}
        {stage === 'EVALUATED' && (
          <div className="w-full max-w-md my-4 p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
            <div className="text-xs font-mono text-zinc-400 tracking-wider">综合起步评分</div>
            <div className="text-5xl font-mono font-black text-amber-400">
              {score} <span className="text-lg font-bold text-zinc-400">分</span>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full text-center font-mono text-xs mt-1">
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <div className="text-zinc-400">起步反应</div>
                <div className="text-emerald-400 font-bold mt-0.5">
                  {isJumpStart ? '抢跑' : `+${reactionTimeMs}ms`}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <div className="text-zinc-400">弹射品质</div>
                <div className="text-white font-bold mt-0.5">{launchQuality || 'GOOD'}</div>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <div className="text-zinc-400">0-100m 耗时</div>
                <div className="text-amber-300 font-bold mt-0.5">
                  {time100m ? `${time100m.toFixed(3)}s` : '--'}
                </div>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full mt-2 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] font-bold text-sm tracking-wider uppercase text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
            >
              再次挑战 (R)
            </button>
          </div>
        )}

        {/* 操作踏板区域 */}
        {stage !== 'EVALUATED' && (
          <div className="w-full max-w-md mt-6 pt-4 border-t border-white/10 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {/* 油门按键 */}
              <button
                onPointerDown={() => {
                  keyStateRef.current.touch = 0.65;
                  if (synth) synth.init();
                }}
                onPointerUp={() => {
                  keyStateRef.current.touch = 0;
                }}
                onPointerCancel={() => {
                  keyStateRef.current.touch = 0;
                }}
                className="py-4 rounded-2xl bg-amber-600/30 hover:bg-amber-600/40 active:scale-[0.98] border border-amber-500/40 text-amber-300 font-mono font-bold flex flex-col items-center justify-center cursor-pointer select-none"
              >
                <span className="text-lg">🔥 控油门</span>
                <span className="text-[10px] text-amber-200/70">[Space / W]</span>
              </button>

              {/* 弹射发车按键 */}
              <button
                onClick={handleLaunch}
                disabled={stage === 'STABILIZE'}
                className="py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] disabled:opacity-40 border border-rose-400 text-white font-mono font-bold flex flex-col items-center justify-center cursor-pointer select-none"
              >
                <span className="text-lg">⚡ 弹射发车</span>
                <span className="text-[10px] text-rose-200/70">灭灯瞬间点击</span>
              </button>
            </div>
            <div className="text-center text-xs font-mono text-zinc-400">
              按键操作: 保持 [Space] 控油门 · 灭灯瞬间点击 [E] 触发弹射
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
