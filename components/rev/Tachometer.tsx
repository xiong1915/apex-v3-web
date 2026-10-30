// components/rev/Tachometer.tsx
'use client';

import React from 'react';
import styles from './rev.module.css';

interface TachometerProps {
  rpm: number;
  maxRpm: number;
  redlineRpm: number;
  idleRpm: number;
  engineName: string;
}

export function Tachometer({
  rpm,
  maxRpm,
  redlineRpm,
  idleRpm,
  engineName
}: TachometerProps) {
  // 仪表盘角度范围：-120度 到 +120度 (共 240 度跨度)
  const startAngle = -120;
  const totalSweep = 240;
  const ratio = Math.max(0, Math.min(1, (rpm - idleRpm) / (maxRpm - idleRpm)));
  const needleAngle = startAngle + ratio * totalSweep;

  // SVG 弧线计算 (半径 140, 中心 160, 160)
  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  // 240度对应的弧长比例为 240 / 360 = 0.6667
  const arcLength = circumference * (240 / 360);
  const strokeDashoffset = arcLength * (1 - ratio);

  // 红线起始百分比
  const redlineRatio = (redlineRpm - idleRpm) / (maxRpm - idleRpm);
  const isOverRedline = rpm >= redlineRpm;

  return (
    <div className={styles.tachometerWrapper}>
      <svg className={styles.tachoSvg} viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <linearGradient id="rpmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="60%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <filter id="needleGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 底层刻度轨道 */}
        <circle
          cx="160"
          cy="160"
          r={radius}
          className={styles.tachoBgTrack}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset="0"
          transform="rotate(150 160 160)"
        />

        {/* 动态转速进度弧线 */}
        <circle
          cx="160"
          cy="160"
          r={radius}
          className={styles.tachoActiveTrack}
          stroke="url(#rpmGrad)"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(150 160 160)"
        />

        {/* 指针轴心与发光指针 */}
        <g transform={`rotate(${needleAngle} 160 160)`} className={styles.needleGroup}>
          <line
            x1="160"
            y1="160"
            x2="160"
            y2="38"
            className={`${styles.needleLine} ${isOverRedline ? styles.needleRedline : ''}`}
            filter="url(#needleGlow)"
          />
          <circle cx="160" cy="160" r="12" className={styles.needleCenterOuter} />
          <circle cx="160" cy="160" r="5" className={styles.needleCenterInner} />
        </g>
      </svg>

      {/* 仪表盘中心数字液晶区域 */}
      <div className={styles.tachoCenterInfo}>
        <div className={styles.gearDisplay} aria-label="挡位: 空挡">
          <span className={styles.gearLetter}>N</span>
          <span className={styles.gearLabel}>NEUTRAL</span>
        </div>

        <div className={styles.rpmValueDisplay}>
          <span className={styles.rpmDigits}>{rpm.toLocaleString()}</span>
          <span className={styles.rpmUnit}>RPM</span>
        </div>

        <div className={styles.engineMeta}>
          <span className={styles.engineNameText}>{engineName}</span>
          <span className={styles.redlineTag}>
            LIMIT {redlineRpm.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
