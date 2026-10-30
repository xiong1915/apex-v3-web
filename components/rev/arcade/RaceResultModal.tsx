'use client';

import React, { useEffect } from 'react';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { CarSpec } from '@/lib/arcade/car-specs';

export interface RaceResultData {
  carSpec: CarSpec;
  time400m: number;
  time0To100: number | null;
  time0To200: number | null;
  trapSpeedKmh: number;
  reactionTimeMs: number;
  isJumpStart: boolean;
  perfectShiftCount: number;
  totalShifts: number;
  isNewRecord: boolean;
}

interface RaceResultModalProps {
  result: RaceResultData;
  onRestart: () => void;
  onSelectCar: () => void;
  onExitLobby: () => void;
}

export function RaceResultModal({
  result,
  onRestart,
  onSelectCar,
  onExitLobby
}: RaceResultModalProps) {
  // 评级计算
  let rankGrade: 'S' | 'A' | 'B' | 'C' = 'C';
  let rankColor = 'text-zinc-400 border-zinc-500/40 bg-zinc-500/10';
  let rankLabel = '新手冲刺';

  if (!result.isJumpStart) {
    if (result.time400m < 9.6) {
      rankGrade = 'S';
      rankColor = 'text-amber-400 border-amber-400/60 bg-amber-400/15 shadow-[0_0_24px_rgba(251,191,36,0.35)]';
      rankLabel = '世界冠军级';
    } else if (result.time400m < 10.5) {
      rankGrade = 'A';
      rankColor = 'text-purple-400 border-purple-400/60 bg-purple-400/15 shadow-[0_0_20px_rgba(192,132,252,0.3)]';
      rankLabel = '顶级车手';
    } else if (result.time400m < 11.5) {
      rankGrade = 'B';
      rankColor = 'text-sky-400 border-sky-400/50 bg-sky-400/10';
      rankLabel = '熟练排位';
    }
  }

  // 快捷键支持：按 Space 或 R 直接再来一局
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R' || e.key === 'Enter') {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRestart]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <GlassSurface
        className="relative w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-white/15 bg-zinc-950/90 shadow-2xl text-white overflow-hidden"
      >
        {/* 背景光效 */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <div className="text-xs font-mono tracking-widest text-zinc-400 uppercase">
              DRAG RACE · QUARTER MILE (400M)
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
              {result.carSpec.name}
            </h2>
          </div>

          {/* 评级徽章 */}
          <div className="flex flex-col items-center">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center border text-2xl sm:text-3xl font-black font-mono transition-transform ${rankColor}`}
            >
              {rankGrade}
            </div>
            <span className="text-[10px] font-mono tracking-wider mt-1 text-zinc-400">
              {rankLabel}
            </span>
          </div>
        </div>

        {/* 核心大成绩：400 米冲线时间 */}
        <div className="my-6 text-center">
          {result.isNewRecord && (
            <div className="inline-block mb-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.5)]">
              ★ NEW RECORD! 刷新个人最佳纪录 ★
            </div>
          )}

          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-5xl sm:text-6xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-zinc-400">
              {result.time400m.toFixed(3)}
            </span>
            <span className="text-xl font-mono font-bold text-zinc-500">s</span>
          </div>

          {result.isJumpStart && (
            <p className="mt-1 text-xs font-mono text-amber-400 font-medium">
              * 包含抢跑判罚 +5.000s
            </p>
          )}
        </div>

        {/* 遥测详细分段指标 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 py-4 border-y border-white/10 font-mono">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">0-100 km/h</div>
            <div className="text-base sm:text-lg font-bold text-white mt-0.5">
              {result.time0To100 !== null ? `${result.time0To100.toFixed(3)}s` : '--'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">0-200 km/h</div>
            <div className="text-base sm:text-lg font-bold text-white mt-0.5">
              {result.time0To200 !== null ? `${result.time0To200.toFixed(3)}s` : '--'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">冲线尾速</div>
            <div className="text-base sm:text-lg font-bold text-white mt-0.5">
              {result.trapSpeedKmh.toFixed(1)} <span className="text-xs text-zinc-400">km/h</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">起步反应</div>
            <div className="text-base sm:text-lg font-bold text-emerald-400 mt-0.5">
              {result.isJumpStart ? '抢跑' : `+${result.reactionTimeMs}ms`}
            </div>
          </div>
        </div>

        {/* 换挡品质总结 */}
        <div className="mt-4 px-3 py-2 rounded-xl bg-zinc-900/60 border border-white/5 flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-400">完美换挡率 (PERFECT SHIFTS)</span>
          <span className="font-bold text-amber-300">
            {result.perfectShiftCount} / {Math.max(1, result.totalShifts)} 挡
          </span>
        </div>

        {/* 操作按钮组 */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onRestart}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] font-bold text-sm tracking-wider uppercase text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
          >
            再战一局 <span className="opacity-70 text-xs font-normal">(R)</span>
          </button>

          <button
            onClick={onSelectCar}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-sm font-semibold tracking-wider text-zinc-200 transition-all cursor-pointer border border-white/10"
          >
            更换赛车
          </button>

          <button
            onClick={onExitLobby}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-transparent hover:bg-white/5 active:scale-[0.98] text-sm font-medium tracking-wider text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            返回大厅
          </button>
        </div>
      </GlassSurface>
    </div>
  );
}
