// components/rev/ExhaustEffects.tsx
'use client';

import React, { useEffect, useRef, memo } from 'react';
import styles from './rev.module.css';

interface ExhaustEffectsProps {
  isBackfiring: boolean;
  backfireCount: number;
  audioEnergy: number; // 0.0 ~ 1.0
  rpm: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

export const ExhaustEffects = memo(function ExhaustEffects({
  isBackfiring,
  backfireCount,
  audioEnergy,
  rpm
}: ExhaustEffectsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // 1. 触发回火爆火花粒子
  useEffect(() => {
    if (!isBackfiring || rpm === 0) return;

    const count = Math.min(24, 12 * backfireCount);
    const colors = ['#f59e0b', '#ef4444', '#fbbf24', '#ffffff'];

    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 0.8 - Math.PI / 2;
      const speed = 4 + Math.random() * 8;
      particlesRef.current.push({
        x: 150 + (Math.random() - 0.5) * 40,
        y: 60,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 3,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: 15 + Math.random() * 20
      });
    }
  }, [isBackfiring, backfireCount, rpm]);

  // 2. 粒子动画循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // 重力微下坠
        p.life += 1;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const heatScale = rpm === 0 ? 0 : Math.min(1.4, 1 + audioEnergy * 0.5);

  return (
    <div className={styles.exhaustWrapper} aria-hidden="true">
      {/* 双出金属排气尾喉 */}
      <div className={styles.exhaustPipes}>
        <div className={styles.pipeOpening}>
          <div
            className={styles.afterburnerGlow}
            style={{
              opacity: rpm === 0 ? 0 : 0.2 + audioEnergy * 0.8,
              transform: `scale(${heatScale})`
            }}
          />
        </div>
        <div className={styles.pipeOpening}>
          <div
            className={styles.afterburnerGlow}
            style={{
              opacity: rpm === 0 ? 0 : 0.2 + audioEnergy * 0.8,
              transform: `scale(${heatScale})`
            }}
          />
        </div>
      </div>

      {/* 排气火花 Canvas */}
      <canvas
        ref={canvasRef}
        width={300}
        height={120}
        className={styles.sparkCanvas}
      />
    </div>
  );
});
