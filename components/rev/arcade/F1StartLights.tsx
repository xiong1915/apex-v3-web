'use client';

import React from 'react';

export type StartLightState = 'OFF' | 'SEQUENCE' | 'HOLD' | 'LIGHTS_OUT' | 'JUMP_START';

interface F1StartLightsProps {
  stage: StartLightState;
  activeCount: number; // 0..5
  reactionTimeMs?: number | null;
  className?: string;
}

export function F1StartLights({
  stage,
  activeCount,
  reactionTimeMs,
  className = ''
}: F1StartLightsProps) {
  const isJumpStart = stage === 'JUMP_START';
  const isLightsOut = stage === 'LIGHTS_OUT';

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* F1 起步灯箱外框 (Liquid Glass + 磨砂碳纤风) */}
      <div className="relative p-2.5 sm:p-3.5 rounded-2xl bg-zinc-950/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {/* 顶部悬吊横梁装饰 */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gradient-to-r from-transparent via-zinc-700/60 to-transparent rounded-full pointer-events-none" />

        {/* 5 组双联装灯柱 */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3.5 items-center">
          {[0, 1, 2, 3, 4].map((index) => {
            const isColumnLit = (stage === 'SEQUENCE' || stage === 'HOLD') && index < activeCount;
            const isYellowBlink = isJumpStart;

            return (
              <div
                key={index}
                className="flex flex-col gap-1.5 p-1 sm:p-1.5 rounded-xl bg-black/60 border border-white/5 shadow-inner"
              >
                {/* 上灯 (红灯 / 抢跑黄灯) */}
                <div
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-all duration-150 relative ${
                    isYellowBlink
                      ? 'bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.9)] animate-pulse'
                      : isColumnLit
                      ? 'bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.95)] border border-rose-300/80'
                      : 'bg-zinc-900 border border-zinc-800'
                  }`}
                >
                  <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-white/60 pointer-events-none" />
                </div>

                {/* 下灯 (同列联亮) */}
                <div
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-all duration-150 relative ${
                    isYellowBlink
                      ? 'bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.9)] animate-pulse'
                      : isColumnLit
                      ? 'bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.95)] border border-rose-300/80'
                      : 'bg-zinc-900 border border-zinc-800'
                  }`}
                >
                  <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-white/60 pointer-events-none" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 提示文案与起步反应时间 */}
      <div className="mt-2.5 h-6 flex items-center justify-center font-mono text-xs sm:text-sm">
        {stage === 'OFF' && (
          <span className="text-zinc-500 tracking-wider">踩住离合 / 维持转速准备发车</span>
        )}
        {(stage === 'SEQUENCE' || stage === 'HOLD') && (
          <span className="text-rose-400 animate-pulse tracking-widest font-semibold">
            {stage === 'HOLD' ? '等待灭灯 · 保持专注' : `发车灯序列 [${activeCount}/5]`}
          </span>
        )}
        {isLightsOut && (
          <span className="text-emerald-400 font-bold tracking-widest flex items-center gap-2">
            <span>LIGHTS OUT & AWAY WE GO!</span>
            {reactionTimeMs !== undefined && reactionTimeMs !== null && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                +{reactionTimeMs}ms
              </span>
            )}
          </span>
        )}
        {isJumpStart && (
          <span className="text-amber-400 font-bold tracking-wider animate-bounce">
            ⚠️ 抢跑犯规 (JUMP START) · +5.0s 罚时
          </span>
        )}
      </div>
    </div>
  );
}
