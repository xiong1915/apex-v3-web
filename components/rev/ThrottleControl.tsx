// components/rev/ThrottleControl.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import styles from './rev.module.css';

interface ThrottleControlProps {
  throttle: number; // 0.0 ~ 1.0
  onThrottleChange: (val: number) => void;
  disabled?: boolean;
}

export function ThrottleControl({
  throttle,
  onThrottleChange,
  disabled = false
}: ThrottleControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPressing, setIsPressing] = useState(false);
  const keysDownRef = useRef<{ space: boolean; w: boolean }>({ space: false, w: false });

  // 1. 键盘监听 (Space / W 长按踩油门)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      // 避免输入框或交互组件内按键冲突
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;

      if (e.code === 'Space' || e.code === 'KeyW') {
        e.preventDefault();
        if (e.code === 'Space') keysDownRef.current.space = true;
        if (e.code === 'KeyW') keysDownRef.current.w = true;
        onThrottleChange(1.0);
        setIsPressing(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') keysDownRef.current.space = false;
      if (e.code === 'KeyW') keysDownRef.current.w = false;

      if (!keysDownRef.current.space && !keysDownRef.current.w && !isPressing) {
        onThrottleChange(0.0);
        setIsPressing(false);
      }
    };

    const handleBlur = () => {
      keysDownRef.current.space = false;
      keysDownRef.current.w = false;
      setIsPressing(false);
      onThrottleChange(0.0);
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleBlur);
    };
  }, [disabled, onThrottleChange, isPressing]);

  // 2. 指针与触控事件处理 (基于 PointerCapture 实现顺滑拖拽与防误触)
  const calculateThrottleFromPointer = useCallback(
    (clientY: number) => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      // 垂直滑块：底部为 0%，顶部为 100%
      const raw = 1 - (clientY - rect.top) / rect.height;
      return Math.max(0, Math.min(1, raw));
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    setIsPressing(true);
    // 如果直接点击踏板下半部分，至少给予 80% 开度模拟踩踏感
    const val = calculateThrottleFromPointer(e.clientY);
    onThrottleChange(val < 0.2 ? 0.85 : val);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPressing || disabled) return;
    const val = calculateThrottleFromPointer(e.clientY);
    onThrottleChange(val);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
    setIsPressing(false);
    if (!keysDownRef.current.space && !keysDownRef.current.w) {
      onThrottleChange(0.0);
    }
  };

  const pct = Math.round(throttle * 100);

  return (
    <div className={styles.throttleSection}>
      <div
        ref={containerRef}
        className={`${styles.pedalWrapper} ${isPressing ? styles.pedalActive : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label="油门踏板开度"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        {/* 液态玻璃金属踏板主体 */}
        <div className={styles.pedalPlate}>
          {/* 防滑金属刻线 */}
          <div className={styles.pedalTreads}>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          {/* 踏板下压实时液体高度指示 */}
          <div
            className={styles.pedalFillIndicator}
            style={{ height: `${pct}%` }}
          />

          <div className={styles.pedalFootprint}>
            <span className={styles.pedalActionText}>
              {isPressing ? 'THROTTLE ENGAGED' : 'PRESS & HOLD'}
            </span>
            <span className={styles.pedalValueText}>{pct}%</span>
          </div>
        </div>
      </div>

      <div className={styles.throttleHint}>
        <span className={styles.keyBadge}>SPACE</span>
        <span className={styles.orText}>或</span>
        <span className={styles.keyBadge}>W</span>
        <span className={styles.hintText}>按住长踩 · 触摸上下滑动控速</span>
      </div>
    </div>
  );
}
