// components/rev/ExhaustEffects.tsx
'use client';

import React, { useEffect, useRef } from 'react';
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

export function ExhaustEffects({
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
    if (!isBackfiring) return;

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
  }, [isBackfiring, backfireCount]);

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

  // 热浪波纹与低音共振强度 (0 ~ 1)
  const heatIntensity = Math.min(1, Math.max(0, (rpm - 8000) / 10000)) * (0.3 + 0.7 * audioEnergy);

  return (
    <div
      className={styles.exhaustContainer}
      style={{
        // 动态根据声波能量产生轻微微像素抖动（低音震颤）
        transform: heatIntensity > 0.4 ? `translateY(${(Math.random() - 0.5) * 1.5}px)` : 'none'
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        width={300}
        height={100}
        className={styles.sparksCanvas}
      />

      {/* 排气管口光泽底座 */}
      <div className={styles.exhaustPipes}>
        <div className={styles.pipeTip} />
        <div className={styles.pipeTip} />
      </div>

      {/* 热浪漫反射发光层 */}
      <div
        className={styles.heatwaveGlow}
        style={{
          opacity: heatIntensity * 0.8,
          transform: `scale(${1 + heatIntensity * 0.15})`
        }}
      />
    </div>
  );
}
