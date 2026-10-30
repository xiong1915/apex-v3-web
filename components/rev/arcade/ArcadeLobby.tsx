'use client';

import React from 'react';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { getBestRecord } from '@/lib/arcade/storage';

export type ArcadeMode = 'LOBBY' | 'DRAG' | 'LAUNCH' | 'QUIZ' | 'FREE';

interface ArcadeLobbyProps {
  onSelectMode: (mode: ArcadeMode) => void;
}

export function ArcadeLobby({ onSelectMode }: ArcadeLobbyProps) {
  const v10Best = getBestRecord('v10-2004');
  const v8Best = getBestRecord('v8-2010');
  const v6Best = getBestRecord('v6-2026');

  // 最佳冲线成绩
  const bestTimes = [v10Best?.time400m, v8Best?.time400m, v6Best?.time400m].filter(Boolean) as number[];
  const best400m = bestTimes.length > 0 ? Math.min(...bestTimes).toFixed(3) : null;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center gap-6 animate-in fade-in duration-300">
      {/* 顶部标语 */}
      <div className="text-center max-w-xl px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs font-semibold uppercase tracking-wider mb-2">
          <span>ARCADE V2.0</span>
          <span>·</span>
          <span>F1 赛车街机小游戏</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
          选择你的挑战模式
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-2 font-mono">
          从五盏红灯弹射起步，到 400 米极速冲刺与盲测鉴赏，体验纯粹 F1 声学与操控。
        </p>
      </div>

      {/* 模式选择卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full px-2">
        {/* 卡片 1: 直线加速赛 (核心主推) */}
        <GlassSurface
          onClick={() => onSelectMode('DRAG')}
          className="group relative p-6 sm:p-8 rounded-3xl border border-white/10 hover:border-rose-500/50 bg-zinc-950/70 hover:bg-zinc-900/80 transition-all duration-300 cursor-pointer shadow-xl overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-rose-600/15 rounded-full blur-3xl pointer-events-none group-hover:bg-rose-600/25 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl sm:text-3xl">🏁</span>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold tracking-wider">
                CORE · 核心玩法
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-rose-400 transition-colors">
              0-400M 直线加速赛
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              F1 经典五盏红灯熄灭发车，手动 1~7/8 挡进阶换挡，真实变速箱齿比与轮胎抓地力物理，冲击世界冠军级纪录！
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs">
            <span className="text-zinc-500">
              最佳战绩: <span className="text-amber-400 font-bold">{best400m ? `${best400m}s` : '暂无'}</span>
            </span>
            <span className="text-rose-400 font-bold group-hover:translate-x-1 transition-transform">
              立即发车 →
            </span>
          </div>
        </GlassSurface>

        {/* 卡片 2: 弹射起步挑战 */}
        <GlassSurface
          onClick={() => onSelectMode('LAUNCH')}
          className="group relative p-6 sm:p-8 rounded-3xl border border-white/10 hover:border-emerald-500/50 bg-zinc-950/70 hover:bg-zinc-900/80 transition-all duration-300 cursor-pointer shadow-xl overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-600/25 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl sm:text-3xl">🎯</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold tracking-wider">
                PRECISION · 技巧挑战
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">
              弹射起步技巧挑战
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              油门精准控制在绿色最佳爆发窗口，灭灯瞬间毫秒级离合爆发，考验车手极限神经反射。
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs">
            <span className="text-zinc-500">考验: 转速稳定 + 毫秒反应</span>
            <span className="text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
              进入挑战 →
            </span>
          </div>
        </GlassSurface>

        {/* 卡片 3: 听声辨引擎 */}
        <GlassSurface
          onClick={() => onSelectMode('QUIZ')}
          className="group relative p-6 sm:p-8 rounded-3xl border border-white/10 hover:border-purple-500/50 bg-zinc-950/70 hover:bg-zinc-900/80 transition-all duration-300 cursor-pointer shadow-xl overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-600/25 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl sm:text-3xl">🎧</span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold tracking-wider">
                BLIND TEST · 听力盲测
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">
              听声辨引擎盲测
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              10 题随机盲测挑战！辨析万九 V10 尖啸、V8 撕裂咆哮与 V6 混动涡轮，斩获连击倍率登顶满分。
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs">
            <span className="text-zinc-500">题量: 10 题 · 连击倍率</span>
            <span className="text-purple-400 font-bold group-hover:translate-x-1 transition-transform">
              开始盲测 →
            </span>
          </div>
        </GlassSurface>

        {/* 卡片 4: 自由声浪室 */}
        <GlassSurface
          onClick={() => onSelectMode('FREE')}
          className="group relative p-6 sm:p-8 rounded-3xl border border-white/10 hover:border-zinc-400/50 bg-zinc-950/70 hover:bg-zinc-900/80 transition-all duration-300 cursor-pointer shadow-xl overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-zinc-600/15 rounded-full blur-3xl pointer-events-none group-hover:bg-zinc-600/25 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl sm:text-3xl">🔊</span>
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-500/20 text-zinc-300 border border-zinc-500/30 text-[10px] font-mono font-bold tracking-wider">
                CLASSIC · 自由轰鸣
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-zinc-200 transition-colors">
              自由声浪互动室
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              经典自由轰油门模式。尽情踩踏油门踏板，观察排气管喷火、换挡指示灯与声学频谱仪动态。
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs">
            <span className="text-zinc-500">自由控油 · 声学仪表</span>
            <span className="text-zinc-300 font-bold group-hover:translate-x-1 transition-transform">
              进入声浪室 →
            </span>
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}
