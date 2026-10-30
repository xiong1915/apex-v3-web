'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

import { ENGINE_PRESETS, EnginePreset } from '@/lib/audio/engine-presets';
import { F1EngineSynthesizer } from '@/lib/audio/engine-synthesizer';
import { AchievementDef, tryUnlockAchievement } from '@/lib/arcade/storage';

interface SoundQuizViewProps {
  synth: F1EngineSynthesizer | null;
  onUnlockAchievement: (ach: AchievementDef) => void;
  onExitToLobby: () => void;
}

interface Question {
  targetId: 'v10-2004' | 'v8-2010' | 'v6-2026';
  targetPreset: EnginePreset;
  startRpm: number;
  peakRpm: number;
}

const CAR_OPTIONS = [
  {
    id: 'v10-2004',
    title: '2004 3.0L V10 自然吸气',
    tag: '万九尖啸 · F2004',
    desc: '高达 19,000 RPM 极致高频尖鸣'
  },
  {
    id: 'v8-2010',
    title: '2010 2.4L V8 自然吸气',
    tag: '撕裂咆哮 · RB6',
    desc: '18,000 RPM 饱满穿透力声浪'
  },
  {
    id: 'v6-2026',
    title: '2026 1.6L V6 涡轮混动',
    tag: '深沉涡轮 · Turbo Hybrid',
    desc: '15,000 RPM 伴随高频涡轮啸叫'
  }
];

export function SoundQuizView({
  synth,
  onUnlockAchievement,
  onExitToLobby
}: SoundQuizViewProps) {
  const [currentRound, setCurrentRound] = useState<number>(1);
  const totalRounds = 10;

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);

  // 答题与计分状态
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [isQuizFinished, setIsQuizFinished] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // 声浪播放动画 Ref
  const playTimerRef = useRef<number | null>(null);

  // 生成单题
  const generateQuestion = useCallback((): Question => {
    const keys: ('v10-2004' | 'v8-2010' | 'v6-2026')[] = ['v10-2004', 'v8-2010', 'v6-2026'];
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const preset = ENGINE_PRESETS[randomKey];
    return {
      targetId: randomKey,
      targetPreset: preset,
      startRpm: preset.idleRpm,
      peakRpm: preset.redlineRpm - 500
    };
  }, []);

  // 播放 3 秒特征盲测声浪 (从怠速飙升到高转并回落)
  const playSample = useCallback(
    (question: Question) => {
      if (!synth) return;
      synth.init();
      synth.switchPreset(question.targetPreset);

      if (playTimerRef.current) cancelAnimationFrame(playTimerRef.current);
      setIsPlaying(true);

      const durationMs = 2800;
      const startTime = performance.now();

      const runPlayback = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);

        // 模拟转速曲线：先加速冲顶再松油门回落
        let curRpm = question.startRpm;
        let load = 0.8;
        if (progress < 0.65) {
          const p = progress / 0.65;
          curRpm = question.startRpm + Math.pow(p, 1.4) * (question.peakRpm - question.startRpm);
          load = 0.95;
        } else {
          const p = (progress - 0.65) / 0.35;
          curRpm = question.peakRpm - p * (question.peakRpm - question.startRpm * 1.5);
          load = 0.1;
        }

        synth.updateSound(Math.max(question.startRpm, curRpm), load, false);

        if (progress < 1) {
          playTimerRef.current = requestAnimationFrame(runPlayback);
        } else {
          setIsPlaying(false);
          synth.updateSound(question.startRpm, 0.05, false);
        }
      };

      playTimerRef.current = requestAnimationFrame(runPlayback);
    },
    [synth]
  );

  // 初始化第一题
  useEffect(() => {
    const q = generateQuestion();
    setCurrentQuestion(q);
  }, [generateQuestion]);

  // 选择答案
  const handleSelectAnswer = (choiceId: string) => {
    if (isAnswerRevealed || !currentQuestion) return;
    setSelectedAnswer(choiceId);
    setIsAnswerRevealed(true);

    const isCorrect = choiceId === currentQuestion.targetId;
    if (isCorrect) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setMaxCombo((prev) => Math.max(prev, nextCombo));

      const multiplier = nextCombo >= 5 ? 2.0 : nextCombo >= 3 ? 1.5 : 1.0;
      setScore((prev) => prev + Math.round(100 * multiplier));
    } else {
      setCombo(0);
    }

    // 延迟 1.5 秒进入下一题或结算
    setTimeout(() => {
      if (currentRound < totalRounds) {
        setCurrentRound((prev) => prev + 1);
        const nextQ = generateQuestion();
        setCurrentQuestion(nextQ);
        setSelectedAnswer(null);
        setIsAnswerRevealed(false);
        playSample(nextQ);
      } else {
        setIsQuizFinished(true);
        // 满分成就判定
        if (score + (isCorrect ? 100 : 0) >= 1000) {
          const ach = tryUnlockAchievement('engine_guru');
          if (ach) onUnlockAchievement(ach);
        }
      }
    }, 1500);
  };

  // 重置测试
  const handleRestart = () => {
    setCurrentRound(1);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setSelectedAnswer(null);
    setIsAnswerRevealed(false);
    setIsQuizFinished(false);
    setCopied(false);
    const q = generateQuestion();
    setCurrentQuestion(q);
    playSample(q);
  };

  // 复制成绩
  const handleCopyShare = () => {
    const shareText = `🏎️ APEX V3 听声辨引擎挑战！\n我在 10 题盲测中拿到了 ${score} 分！最高连击: ${maxCombo}x\n来挑战你的 F1 听觉极限: https://f1.tike69.cc.cd/rev`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6 animate-in fade-in duration-300">
      {/* 顶部标题与进度 */}
      <div className="w-full flex items-center justify-between px-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-rose-400 font-bold">
            题号: {currentRound} / {totalRounds}
          </span>
          {combo > 1 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
              ⚡ COMBO x{combo}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-zinc-400">
            得分: <span className="text-white font-bold">{score}</span>
          </span>
          <button
            onClick={onExitToLobby}
            className="text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer"
          >
            返回大厅
          </button>
        </div>
      </div>

      {!isQuizFinished ? (
        <div style={{ background: 'rgba(15, 17, 23, 0.96)' }}
          className="relative w-full p-6 sm:p-8 rounded-3xl border border-white/15 bg-zinc-950/85 shadow-2xl backdrop-blur-2xl text-white flex flex-col items-center"
        >
          <div className="text-xs font-mono tracking-widest text-zinc-400 uppercase mb-4">
            SOUND QUIZ · 听声辨引擎盲测
          </div>

          {/* 声音播放器与动态波形 */}
          <div className="w-full my-4 flex flex-col items-center gap-4">
            <div className="w-full h-24 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center gap-1.5 px-6 overflow-hidden relative">
              {/* 动态声波柱模拟 */}
              {[...Array(24)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-75 ${
                    isPlaying
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                      : 'bg-zinc-800'
                  }`}
                  style={{
                    height: isPlaying ? `${20 + Math.random() * 70}%` : '8%'
                  }}
                />
              ))}

              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                  <span className="text-xs font-mono text-zinc-400">点击下方按钮试听</span>
                </div>
              )}
            </div>

            {/* 播放音频按钮 */}
            <button
              onClick={() => currentQuestion && playSample(currentQuestion)}
              disabled={isPlaying}
              className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-40 border border-white/10 text-xs font-mono font-bold tracking-wider uppercase text-zinc-200 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>{isPlaying ? '🔊 正在播放声浪...' : '▶ 播放特征声浪 (3秒)'}</span>
            </button>
          </div>

          {/* 选项按钮列表 */}
          <div className="w-full flex flex-col gap-3 mt-4">
            {CAR_OPTIONS.map((opt) => {
              const isSelected = selectedAnswer === opt.id;
              const isCorrectTarget = currentQuestion?.targetId === opt.id;

              let btnStyle = 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-white';
              if (isAnswerRevealed) {
                if (isCorrectTarget) {
                  btnStyle =
                    'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.4)]';
                } else if (isSelected) {
                  btnStyle = 'bg-rose-500/20 border-rose-400 text-rose-300';
                } else {
                  btnStyle = 'opacity-40 border-white/5';
                }
              }

              return (
                <button
                  key={opt.id}
                  disabled={isAnswerRevealed}
                  onClick={() => handleSelectAnswer(opt.id)}
                  className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${btnStyle}`}
                >
                  <div>
                    <div className="text-sm sm:text-base font-bold font-mono">{opt.title}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{opt.desc}</div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-1 rounded bg-white/5 text-zinc-300">
                    {opt.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* 结算卡片 */
        <div style={{ background: 'rgba(15, 17, 23, 0.96)' }}
          className="relative w-full p-6 sm:p-8 rounded-3xl border border-white/15 bg-zinc-950/90 shadow-2xl backdrop-blur-2xl text-white flex flex-col items-center animate-in zoom-in-95 duration-200"
        >
          <div className="text-xs font-mono tracking-widest text-zinc-400 uppercase mb-2">
            QUIZ COMPLETE · 盲测成绩单
          </div>

          <div className="text-6xl font-mono font-black text-amber-400 my-2">
            {score} <span className="text-xl font-bold text-zinc-400">PTS</span>
          </div>

          <div className="text-sm font-mono text-zinc-300 mt-1">
            {score >= 900
              ? '👑 赛道声学泰斗 · 绝对耳力'
              : score >= 600
              ? '⚡ 资深 F1 狂热车迷'
              : '🌱 新手车迷 · 还需多听声浪'}
          </div>

          <div className="grid grid-cols-2 gap-3 w-full max-w-sm my-6 font-mono text-xs text-center">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="text-zinc-400">最高连击</div>
              <div className="text-lg font-bold text-amber-300 mt-0.5">{maxCombo} 连对</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="text-zinc-400">总答题数</div>
              <div className="text-lg font-bold text-white mt-0.5">10 题</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
            <button
              onClick={handleRestart}
              className="w-full sm:flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] font-bold text-sm tracking-wider uppercase text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
            >
              再来一轮
            </button>
            <button
              onClick={handleCopyShare}
              className="w-full sm:w-auto px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-sm font-semibold tracking-wider text-zinc-200 transition-all cursor-pointer border border-white/10"
            >
              {copied ? '✓ 已复制战绩' : '分享成绩'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
