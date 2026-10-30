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

  const onThrottleChangeRef = useRef(onThrottleChange);
  onThrottleChangeRef.current = onThrottleChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // 输入来源独立记录 (Pointer, Space, W)
  const inputsRef = useRef({
    pointerActive: false,
    pointerValue: 0,
    spaceActive: false,
    wActive: false
  });

  // 综合计算有效油门开度
  const updateEffectiveThrottle = useCallback(() => {
    if (disabledRef.current) {
      onThrottleChangeRef.current(0.0);
      setIsPressing(false);
      return;
    }

    const { pointerActive, pointerValue, spaceActive, wActive } = inputsRef.current;
    let max = 0;
    if (pointerActive) max = Math.max(max, pointerValue);
    if (spaceActive) max = Math.max(max, 1.0);
    if (wActive) max = Math.max(max, 1.0);

    const clamped = Math.max(0, Math.min(1, Math.round(max * 1000) / 1000));
    onThrottleChangeRef.current(clamped);
    setIsPressing(clamped > 0);
  }, []);

  // 全量重置输入 (失焦、切后台、卸载、disabled 改变)
  const clearAllInputs = useCallback(() => {
    inputsRef.current = {
      pointerActive: false,
      pointerValue: 0,
      spaceActive: false,
      wActive: false
    };
    updateEffectiveThrottle();
  }, [updateEffectiveThrottle]);

  useEffect(() => {
    if (disabled) {
      clearAllInputs();
    }
  }, [disabled, clearAllInputs]);

  // 1. 键盘监听 (Space / W 长按踩油门，独立状态释放)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabledRef.current) return;
      if (e.repeat) return; // 忽略操作系统按键自动重复

      // 避免输入框或可编辑区内按键冲突
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      // 避免干扰外部普通导航链接跳转
      if (e.code === 'Space' && target && target.tagName === 'A') {
        return;
      }

      if (e.code === 'Space' || e.code === 'KeyW') {
        e.preventDefault();
        if (e.code === 'Space') inputsRef.current.spaceActive = true;
        if (e.code === 'KeyW') inputsRef.current.wActive = true;
        updateEffectiveThrottle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      let changed = false;
      if (e.code === 'Space') {
        inputsRef.current.spaceActive = false;
        changed = true;
      }
      if (e.code === 'KeyW') {
        inputsRef.current.wActive = false;
        changed = true;
      }

      if (changed) {
        updateEffectiveThrottle();
      }
    };

    const handleBlur = () => {
      clearAllInputs();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearAllInputs();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateEffectiveThrottle, clearAllInputs]);

  // 2. 指针与触控统一物理映射 (基于 PointerCapture，向上滑动增加油门)
  const calculateThrottleFromPointer = useCallback((clientY: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.height <= 0) return 0;

    // 垂直滑块统一规则：底部为 0%，顶部为 100%
    const raw = 1 - (clientY - rect.top) / rect.height;
    // 增加底部 4% 和顶部 4% 的安全死区，防止边缘抖动
    if (raw <= 0.04) return 0;
    if (raw >= 0.96) return 1.0;
    return Math.max(0, Math.min(1, raw));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabledRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    const val = calculateThrottleFromPointer(e.clientY);
    inputsRef.current.pointerActive = true;
    inputsRef.current.pointerValue = val;
    updateEffectiveThrottle();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!inputsRef.current.pointerActive || disabledRef.current) return;
    const val = calculateThrottleFromPointer(e.clientY);
    inputsRef.current.pointerValue = val;
    updateEffectiveThrottle();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    inputsRef.current.pointerActive = false;
    inputsRef.current.pointerValue = 0;
    updateEffectiveThrottle();
  };

  const pct = Math.round(throttle * 100);

  return (
    <div className={styles.throttleSection}>
      <div
        ref={containerRef}
        className={`${styles.pedalWrapper} ${isPressing ? styles.pedalActive : ''} ${disabled ? styles.pedalDisabled : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label="油门踏板开度"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
      >
        {/* 液态玻璃金属踏板主体 */}
        <div className={styles.pedalPlate}>
          {/* 防滑金属刻线 */}
          <div className={styles.pedalTreads}>
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
              {disabled
                ? 'ENGINE OFF'
                : isPressing
                ? 'THROTTLE ENGAGED'
                : 'PUSH UP TO ACCEL'}
            </span>
            <span className={styles.pedalValueText}>{disabled ? '0%' : `${pct}%`}</span>
          </div>
        </div>
      </div>

      <div className={styles.throttleHint}>
        <span className={styles.keyBadge}>SPACE</span>
        <span className={styles.orText}>/</span>
        <span className={styles.keyBadge}>W</span>
        <span className={styles.hintText}>
          {disabled ? '请先点火启动引擎' : '按住提速 · 触摸向上滑动控速'}
        </span>
      </div>
    </div>
  );
}
