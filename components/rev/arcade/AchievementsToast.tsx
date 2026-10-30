'use client';

import React, { useEffect } from 'react';

import { AchievementDef } from '@/lib/arcade/storage';

interface AchievementsToastProps {
  achievement: AchievementDef | null;
  onClose: () => void;
}

export function AchievementsToast({ achievement, onClose }: AchievementsToastProps) {
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [achievement, onClose]);

  if (!achievement) return null;

  return (
    <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div style={{ background: 'rgba(15, 17, 23, 0.96)' }}
        className="flex items-center gap-3.5 p-4 pr-6 rounded-2xl border border-amber-400/40 bg-zinc-950/90 shadow-[0_8px_32px_rgba(251,191,36,0.25)] text-white"
      >
        <div className="w-12 h-12 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-2xl shadow-inner">
          {achievement.icon}
        </div>
        <div>
          <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-amber-400">
            ACHIEVEMENT UNLOCKED · 成就解锁
          </div>
          <div className="text-sm font-bold text-white mt-0.5">{achievement.title}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{achievement.description}</div>
        </div>
      </div>
    </div>
  );
}
