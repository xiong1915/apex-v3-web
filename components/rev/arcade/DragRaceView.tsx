'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { CAR_SPECS } from '@/lib/arcade/car-specs';
import { DragPhysicsEngine, DragRaceTelemetry, ShiftQuality } from '@/lib/arcade/drag-physics';
import { F1EngineSynthesizer } from '@/lib/audio/engine-synthesizer';
import { F1StartLights, StartLightState } from './F1StartLights';
import { RaceResultModal, RaceResultData } from './RaceResultModal';
import {
  getBestRecord,
  saveRaceRecordIfBest,
  getGhostTrajectory,
  saveGhostTrajectory,
  tryUnlockAchievement,
  GhostPoint,
  AchievementDef
} from '@/lib/arcade/storage';

interface DragRaceViewProps {
  synth: F1EngineSynthesizer | null;
  onUnlockAchievement: (ach: AchievementDef) => void;
  onExitToLobby: () => void;
}

export function DragRaceView({
  synth,
  onUnlockAchievement,
  onExitToLobby
}: DragRaceViewProps) {
  // 当前选择车型
  const [selectedCarId, setSelectedCarId] = useState<'v10-2004' | 'v8-2010' | 'v6-2026'>('v10-2004');
  const spec = CAR_SPECS[selectedCarId];

  // 物理引擎实例
  const engineRef = useRef<DragPhysicsEngine>(new DragPhysicsEngine(spec));

  // 发车灯状态机
  const [lightStage, setLightStage] = useState<StartLightState>('OFF');
  const [lightCount, setLightCount] = useState<number>(0);
  const lightsOutTimeRef = useRef<number | null>(null);
  const isHoldingRef = useRef<boolean>(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sequenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 比赛进行状态
  const [raceStatus, setRaceStatus] = useState<'STAGING' | 'COUNTDOWN' | 'RACING' | 'FINISHED'>('STAGING');
  const [reactionTimeMs, setReactionTimeMs] = useState<number | null>(null);
  const [isJumpStart, setIsJumpStart] = useState<boolean>(false);

  // 自动换挡开关 (极大提升移动端和新手可玩性)
  const [autoShift, setAutoShift] = useState<boolean>(false);

  // 换挡反馈浮字
  const [shiftFeedback, setShiftFeedback] = useState<{ text: string; color: string; id: number } | null>(null);
  const feedbackIdRef = useRef<number>(0);

  // 实时遥测数据
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

  // 幽灵车数据
  const [ghostPoints, setGhostPoints] = useState<GhostPoint[] | null>(null);
  const [ghostDistanceM, setGhostDistanceM] = useState<number>(0);
  const ghostTrajectoryRef = useRef<GhostPoint[]>([]);

  // 结算面板数据
  const [raceResult, setRaceResult] = useState<RaceResultData | null>(null);

  // 输入状态追踪
  const keyStateRef = useRef<{ space: boolean; keyW: boolean; touch: number }>({
    space: false,
    keyW: false,
    touch: 0
  });

  // 切换车型
  const handleSelectCar = (carId: 'v10-2004' | 'v8-2010' | 'v6-2026') => {
    if (raceStatus === 'RACING' || raceStatus === 'COUNTDOWN') return;
    setSelectedCarId(carId);
    const newSpec = CAR_SPECS[carId];
    engineRef.current.reset(newSpec);
    if (synth) {
      synth.switchPreset(newSpec.enginePreset);
    }
    const ghost = getGhostTrajectory(carId);
    setGhostPoints(ghost);
  };

  // 重置比赛回到准备区
  const handleResetRace = useCallback(() => {
    if (sequenceIntervalRef.current) clearInterval(sequenceIntervalRef.current);
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

    engineRef.current.reset(CAR_SPECS[selectedCarId]);
    setLightStage('OFF');
    setLightCount(0);
    lightsOutTimeRef.current = null;
    isHoldingRef.current = false;
    setRaceStatus('STAGING');
    setReactionTimeMs(null);
    setIsJumpStart(false);
    setShiftFeedback(null);
    setRaceResult(null);
    setGhostDistanceM(0);
    ghostTrajectoryRef.current = [];

    const ghost = getGhostTrajectory(selectedCarId);
    setGhostPoints(ghost);

    const idleRpm = CAR_SPECS[selectedCarId].enginePreset.idleRpm;
    setTelemetry({
      speedKmh: 0,
      speedMs: 0,
      distanceM: 0,
      rpm: idleRpm,
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
    });
  }, [selectedCarId]);

  // 载入历史幽灵车
  useEffect(() => {
    const ghost = getGhostTrajectory(selectedCarId);
    setGhostPoints(ghost);
  }, [selectedCarId]);

  // 显示换挡评价浮字
  const triggerShiftFeedback = (quality: ShiftQuality, isOverRev: boolean = false) => {
    feedbackIdRef.current++;
    const currentId = feedbackIdRef.current;

    let text = 'GOOD SHIFT';
    let color = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';

    if (isOverRev) {
      text = '⚠️ 过转保护锁止 (OVER-REV BLOCKED)';
      color = 'text-rose-400 border-rose-500/50 bg-rose-500/20';
    } else if (quality === 'PERFECT') {
      text = '⚡ PERFECT SHIFT! 完美换挡';
      color = 'text-amber-300 border-amber-400/60 bg-amber-400/20 shadow-[0_0_20px_rgba(251,191,36,0.5)]';
    } else if (quality === 'EARLY') {
      text = '转速过早 (EARLY)';
      color = 'text-amber-500/90 border-amber-500/30 bg-amber-500/10';
    } else if (quality === 'LIMITER' || quality === 'LATE') {
      text = '断油超转 (LATE / LIMITER)';
      color = 'text-rose-400 border-rose-500/40 bg-rose-500/10';
    }

    setShiftFeedback({ text, color, id: currentId });
    setTimeout(() => {
      setShiftFeedback((prev) => (prev?.id === currentId ? null : prev));
    }, 1200);
  };

  // 执行发车动作 (释放离合器挂入 1 挡)
  const performLaunch = useCallback(() => {
    const now = performance.now();

    // 检查是否在灭灯前提前起跑 (抢跑判定)
    if (lightStage === 'SEQUENCE' || lightStage === 'HOLD') {
      if (sequenceIntervalRef.current) clearInterval(sequenceIntervalRef.current);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      setLightStage('JUMP_START');
      setIsJumpStart(true);
      setRaceStatus('RACING');
      engineRef.current.launch();
      return;
    }

    // 灭灯起步计算反应时间
    if (lightsOutTimeRef.current) {
      const diffMs = Math.round(now - lightsOutTimeRef.current);
      setReactionTimeMs(diffMs);

      const { quality } = engineRef.current.launch();
      if (quality === 'PERFECT') {
        triggerShiftFeedback('PERFECT');
        if (diffMs <= 200) {
          const ach = tryUnlockAchievement('perfect_launcher');
          if (ach) onUnlockAchievement(ach);
        }
      }
      setRaceStatus('RACING');
    } else {
      engineRef.current.launch();
      setRaceStatus('RACING');
    }
  }, [lightStage, onUnlockAchievement]);

  // 启动发车程序 (点亮五盏发车灯)
  const startLaunchSequence = useCallback(() => {
    if (raceStatus !== 'STAGING') return;
    if (synth) synth.init();

    setRaceStatus('COUNTDOWN');
    setLightStage('SEQUENCE');
    setLightCount(1);

    let count = 1;
    sequenceIntervalRef.current = setInterval(() => {
      count++;
      if (count <= 5) {
        setLightCount(count);
      } else {
        if (sequenceIntervalRef.current) clearInterval(sequenceIntervalRef.current);
        setLightStage('HOLD');
        isHoldingRef.current = true;

        // 随机保持 0.8s ~ 2.4s 瞬间熄灯
        const randomHoldMs = 800 + Math.random() * 1600;
        holdTimeoutRef.current = setTimeout(() => {
          isHoldingRef.current = false;
          lightsOutTimeRef.current = performance.now();
          setLightStage('LIGHTS_OUT');

          // 【关键体验优化】如果玩家此时已经踩着油门，灭灯瞬间自动弹射起步！
          const k = keyStateRef.current;
          if (k.space || k.keyW || k.touch > 0) {
            performLaunch();
          }
        }, randomHoldMs);
      }
    }, 1000);
  }, [raceStatus, synth, performLaunch]);

  // 升挡
  const handleShiftUp = useCallback(() => {
    if (raceStatus === 'STAGING') {
      startLaunchSequence();
      return;
    }
    if (raceStatus === 'COUNTDOWN') {
      // 倒计时阶段按发车/升挡即为发车操作 (若未灭灯则触发抢跑)
      performLaunch();
      return;
    }
    if (engineRef.current.getGear() === 0) {
      performLaunch();
      return;
    }

    const res = engineRef.current.shiftUp();
    if (res.success) {
      triggerShiftFeedback(res.quality);
      if (synth) synth.triggerBackfire();
    }
  }, [raceStatus, startLaunchSequence, performLaunch, synth]);

  // 降挡
  const handleShiftDown = useCallback(() => {
    if (raceStatus !== 'RACING') return;
    const res = engineRef.current.shiftDown();
    if (!res.success && res.reason?.includes('OVER-REV')) {
      triggerShiftFeedback('NONE', true);
    }
  }, [raceStatus]);

  // 踩油门通用处理 (若灭灯后处于空挡，踩油门直接自动发车！)
  const handleThrottleInputStart = useCallback((source: 'space' | 'keyW' | 'touch', val: number = 1.0) => {
    if (synth) synth.init();

    if (source === 'space') keyStateRef.current.space = true;
    if (source === 'keyW') keyStateRef.current.keyW = true;
    if (source === 'touch') keyStateRef.current.touch = val;

    // 如果比赛已经灭灯且在空挡，踩油门直接发车！
    if (lightStage === 'LIGHTS_OUT' && engineRef.current.getGear() === 0) {
      performLaunch();
    }
  }, [synth, lightStage, performLaunch]);

  const handleThrottleInputStop = useCallback((source: 'space' | 'keyW' | 'touch') => {
    if (source === 'space') keyStateRef.current.space = false;
    if (source === 'keyW') keyStateRef.current.keyW = false;
    if (source === 'touch') keyStateRef.current.touch = 0;
  }, []);

  // 键盘与事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleThrottleInputStart('space', 1.0);
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleThrottleInputStart('keyW', 1.0);
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        handleShiftUp();
      } else if (e.code === 'KeyQ' || e.code === 'ArrowDown') {
        e.preventDefault();
        handleShiftDown();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleResetRace();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        handleThrottleInputStop('space');
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        handleThrottleInputStop('keyW');
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
    document.addEventListener('visibilitychange', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleBlur);
    };
  }, [handleThrottleInputStart, handleThrottleInputStop, handleShiftUp, handleShiftDown, handleResetRace]);

  // 物理与音频主循环
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const k = keyStateRef.current;
      const keyThrottle = (k.space ? 1.0 : 0.0) || (k.keyW ? 1.0 : 0.0);
      const throttle = Math.max(keyThrottle, k.touch);

      const isRacing = raceStatus === 'RACING';
      const telem = engineRef.current.step(dt, throttle, isRacing);
      setTelemetry(telem);

      // 自动换挡逻辑 (开启自动换挡时，达到最佳转速区间自动无缝升挡)
      if (autoShift && isRacing && !telem.isFinished) {
        if (telem.rpm >= spec.optimalShiftRpmMin && telem.gear < spec.totalGears) {
          handleShiftUp();
        }
      }

      // 声音驱动
      if (synth) {
        synth.updateSound(telem.rpm, throttle, telem.isLimiterActive);
      }

      // 比赛进行中采样幽灵轨迹与匹配历史幽灵
      if (isRacing && !telem.isFinished) {
        const timeElapsedMs = Math.round(currentTime - (lightsOutTimeRef.current || currentTime));
        ghostTrajectoryRef.current.push({
          timeMs: timeElapsedMs,
          distanceM: telem.distanceM,
          speedKmh: telem.speedKmh,
          gear: telem.gear
        });

        if (ghostPoints && ghostPoints.length > 0) {
          const match = ghostPoints.find((p) => p.timeMs >= timeElapsedMs);
          if (match) {
            setGhostDistanceM(match.distanceM);
          } else {
            setGhostDistanceM(400);
          }
        }
      }

      // 冲过 400m 终点结算
      if (telem.isFinished && raceStatus === 'RACING') {
        setRaceStatus('FINISHED');

        const baseTime = telem.time400m || 10.0;
        const finalTime = isJumpStart ? baseTime + 5.0 : baseTime;
        const trapSpeed = telem.trapSpeedKmh || telem.speedKmh;
        const rxTime = reactionTimeMs || 250;

        const recordObj = {
          carId: selectedCarId,
          time400m: finalTime,
          time0To100: telem.time0To100,
          time0To200: telem.time0To200,
          trapSpeedKmh: trapSpeed,
          reactionTimeMs: rxTime,
          perfectShiftCount: telem.perfectShiftCount,
          date: new Date().toISOString()
        };

        const isNewRecord = saveRaceRecordIfBest(recordObj);
        if (isNewRecord) {
          saveGhostTrajectory(selectedCarId, ghostTrajectoryRef.current);
        }

        const firstAch = tryUnlockAchievement('first_race');
        if (firstAch) onUnlockAchievement(firstAch);

        if (finalTime < 10.0 && !isJumpStart) {
          const sub10Ach = tryUnlockAchievement('sub_10s');
          if (sub10Ach) onUnlockAchievement(sub10Ach);
        }

        if (telem.perfectShiftCount >= 4) {
          const gearAch = tryUnlockAchievement('gearbox_god');
          if (gearAch) onUnlockAchievement(gearAch);
        }

        setRaceResult({
          carSpec: spec,
          time400m: finalTime,
          time0To100: telem.time0To100,
          time0To200: telem.time0To200,
          trapSpeedKmh: trapSpeed,
          reactionTimeMs: rxTime,
          isJumpStart,
          perfectShiftCount: telem.perfectShiftCount,
          totalShifts: telem.gear,
          isNewRecord
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [raceStatus, selectedCarId, spec, isJumpStart, reactionTimeMs, ghostPoints, autoShift, synth, onUnlockAchievement, handleShiftUp]);

  const isShiftOptimal =
    telemetry.rpm >= spec.optimalShiftRpmMin && telemetry.rpm <= spec.optimalShiftRpmMax;
  const rpmPercent = Math.min(
    100,
    Math.max(0, ((telemetry.rpm - spec.enginePreset.idleRpm) / (spec.enginePreset.redlineRpm - spec.enginePreset.idleRpm)) * 100)
  );

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-4 sm:gap-6 animate-in fade-in duration-300 select-none">
      {/* 顶部车型选择与模式状态 */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
        {/* 车型选择药丸 */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-950/80 border border-white/10 backdrop-blur-md">
          {(['v10-2004', 'v8-2010', 'v6-2026'] as const).map((id) => {
            const isSelected = selectedCarId === id;
            return (
              <button
                key={id}
                disabled={raceStatus === 'RACING' || raceStatus === 'COUNTDOWN'}
                onClick={() => handleSelectCar(id)}
                className={`px-3 sm:px-4 py-1.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 disabled:opacity-40'
                }`}
              >
                {CAR_SPECS[id].shortName}
              </button>
            );
          })}
        </div>

        {/* 自动换挡开关与纪录 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoShift((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
              autoShift
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
            }`}
          >
            {autoShift ? '⚙️ 自动换挡: ON' : '⚙️ 手动换挡: ON'}
          </button>

          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 bg-white/[0.03] px-3.5 py-1.5 rounded-xl border border-white/5">
            <span>纪录:</span>
            <span className="font-bold text-amber-400">
              {getBestRecord(selectedCarId)?.time400m
                ? `${getBestRecord(selectedCarId)!.time400m.toFixed(3)}s`
                : '暂无'}
            </span>
          </div>
        </div>
      </div>

      {/* F1 起步五盏红灯 */}
      <F1StartLights
        stage={lightStage}
        activeCount={lightCount}
        reactionTimeMs={reactionTimeMs}
        className="w-full"
      />

      {/* 直线加速主 HUD 视口 (Liquid Glass) */}
      <GlassSurface
        className="relative w-full p-5 sm:p-8 rounded-3xl border border-white/15 bg-zinc-950/80 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-white overflow-hidden flex flex-col items-center"
      >
        {/* 换挡浮动评价浮层 */}
        {shiftFeedback && (
          <div
            className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-1 rounded-full border text-xs sm:text-sm font-mono font-bold tracking-wider animate-in zoom-in-95 duration-150 ${shiftFeedback.color}`}
          >
            {shiftFeedback.text}
          </div>
        )}

        {/* 换挡指示灯组 (Shift Lights Bar) */}
        <div className="w-full max-w-md flex items-center justify-between gap-1.5 mb-4 sm:mb-6 px-4 py-2 rounded-xl bg-black/40 border border-white/5">
          {[...Array(12)].map((_, idx) => {
            const threshold = (idx + 1) * (100 / 12);
            const isLit = rpmPercent >= threshold;
            let dotColor = 'bg-zinc-800';
            if (isLit) {
              if (idx < 5) dotColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
              else if (idx < 9) dotColor = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]';
              else dotColor = 'bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,1.0)] animate-pulse';
            }
            return (
              <div
                key={idx}
                className={`flex-1 h-2 rounded-full transition-colors duration-75 ${dotColor}`}
              />
            );
          })}
        </div>

        {/* 核心仪表：挡位 + 车速 + 转速 */}
        <div className="flex flex-row items-center justify-around w-full gap-2 sm:gap-6 my-2">
          {/* 当前挡位 */}
          <div className="flex flex-col items-center min-w-[70px]">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              GEAR · 挡位
            </span>
            <div
              className={`w-16 h-16 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-3xl sm:text-5xl font-mono font-black border transition-all ${
                isShiftOptimal
                  ? 'border-purple-400 text-purple-300 bg-purple-500/20 shadow-[0_0_24px_rgba(192,132,252,0.6)] animate-pulse'
                  : 'border-white/10 text-white bg-white/[0.02]'
              }`}
            >
              {telemetry.gear === 0 ? 'N' : telemetry.gear}
            </div>
            {isShiftOptimal && (
              <span className="text-[10px] font-mono font-bold text-purple-300 mt-1 animate-bounce">
                ▲ 升挡!
              </span>
            )}
          </div>

          {/* 实时车速 */}
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl sm:text-7xl font-mono font-black tracking-tight text-white">
                {Math.round(telemetry.speedKmh)}
              </span>
              <span className="text-sm sm:text-base font-mono text-zinc-400 font-bold">KM/H</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 font-mono text-xs text-zinc-400 mt-1">
              <span>{telemetry.accelerationG.toFixed(2)}G</span>
              {telemetry.isWheelSpinning && (
                <span className="text-amber-400 font-semibold animate-pulse">轮胎打滑</span>
              )}
            </div>
          </div>

          {/* 实时转速 */}
          <div className="flex flex-col items-center min-w-[80px] sm:min-w-[120px]">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              ENGINE · 转速
            </span>
            <div className="text-2xl sm:text-4xl font-mono font-bold text-zinc-200 mt-1">
              {telemetry.rpm.toLocaleString()}
            </div>
            <span className="text-xs font-mono text-zinc-500">RPM</span>
          </div>
        </div>

        {/* 400 米冲刺赛道距离条与幽灵车对比 */}
        <div className="w-full max-w-2xl mt-5 px-2">
          <div className="flex justify-between items-center text-xs font-mono text-zinc-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              当前: {telemetry.distanceM.toFixed(1)}m
            </span>
            {ghostPoints && (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                幽灵车: {ghostDistanceM.toFixed(1)}m
              </span>
            )}
            <span className="font-bold text-white">400M 终点</span>
          </div>

          {/* 进度轨道 */}
          <div className="relative w-full h-3 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
            {ghostPoints && (
              <div
                className="absolute top-0 bottom-0 bg-cyan-500/40 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, (ghostDistanceM / 400) * 100)}%` }}
              />
            )}
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-400 rounded-full shadow-[0_0_12px_rgba(244,63,94,0.7)] transition-all duration-75"
              style={{ width: `${Math.min(100, (telemetry.distanceM / 400) * 100)}%` }}
            />
          </div>
        </div>

        {/* 底部超醒目操作控制台 (针对手机触控与桌面键盘双重优化) */}
        <div className="w-full max-w-2xl mt-6 pt-5 border-t border-white/10 flex flex-col gap-3">
          {/* 核心操作主按键 */}
          {raceStatus === 'STAGING' ? (
            <button
              onClick={startLaunchSequence}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 active:scale-[0.98] shadow-[0_0_32px_rgba(225,29,72,0.6)] border border-rose-400 text-white font-mono flex flex-col items-center justify-center cursor-pointer transition-all"
            >
              <span className="text-2xl font-black tracking-wider flex items-center gap-2">
                <span>🚦 点击开始发车程序</span>
              </span>
              <span className="text-xs text-rose-200 mt-1">点亮五盏发车灯 · 灭灯瞬间踩油门起步</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3 w-full">
              {/* 升挡按键 (如果是手动挡) */}
              <button
                onClick={handleShiftUp}
                className={`py-5 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer text-white font-mono active:scale-[0.96] touch-manipulation ${
                  isShiftOptimal
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 shadow-[0_0_32px_rgba(192,132,252,0.8)] animate-pulse'
                    : 'bg-white/10 hover:bg-white/15 border-white/20'
                }`}
              >
                <span className="text-2xl sm:text-3xl font-black">▲ 升挡 (E)</span>
                <span className="text-xs text-zinc-300 mt-0.5">
                  {isShiftOptimal ? '★ 立即升挡！' : '达到紫光时点击'}
                </span>
              </button>

              {/* 全油门踏板按键 (支持长按与防菜单) */}
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleThrottleInputStart('touch', 1.0);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  handleThrottleInputStop('touch');
                }}
                onPointerCancel={() => handleThrottleInputStop('touch')}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleThrottleInputStart('touch', 1.0);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleThrottleInputStop('touch');
                }}
                onContextMenu={(e) => e.preventDefault()}
                className="py-5 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 active:from-amber-500 active:to-amber-600 active:scale-[0.96] shadow-[0_0_24px_rgba(245,158,11,0.5)] border border-amber-400 text-white font-mono flex flex-col items-center justify-center cursor-pointer select-none touch-manipulation"
              >
                <span className="text-2xl sm:text-3xl font-black text-amber-100">🔥 按住油门</span>
                <span className="text-xs text-amber-200/90 mt-0.5">[Space / 触控按住]</span>
              </button>
            </div>
          )}

          {/* 辅助按键行 */}
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-2 px-1">
            <div className="flex items-center gap-3">
              <button
                onClick={handleResetRace}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 cursor-pointer"
              >
                ↺ 重新发车 (R)
              </button>
              {raceStatus === 'RACING' && !autoShift && (
                <button
                  onClick={handleShiftDown}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 cursor-pointer"
                >
                  ▼ 降挡 (Q)
                </button>
              )}
            </div>

            <button
              onClick={onExitToLobby}
              className="text-zinc-500 hover:text-zinc-300 underline underline-offset-4 cursor-pointer"
            >
              ← 切换其他模式
            </button>
          </div>
        </div>
      </GlassSurface>

      {/* 结算弹窗 */}
      {raceResult && (
        <RaceResultModal
          result={raceResult}
          onRestart={handleResetRace}
          onSelectCar={handleResetRace}
          onExitLobby={onExitToLobby}
        />
      )}
    </div>
  );
}
