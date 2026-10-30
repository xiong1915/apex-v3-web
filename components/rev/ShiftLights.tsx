// components/rev/ShiftLights.tsx
'use client';

import React, { memo } from 'react';
import styles from './rev.module.css';

interface ShiftLightsProps {
  rpm: number;
  redlineRpm: number;
  idleRpm: number;
}

export const ShiftLights = memo(function ShiftLights({
  rpm,
  redlineRpm,
  idleRpm
}: ShiftLightsProps) {
  // 引擎熄火时熄灭全部指示灯
  const isEngineOff = rpm === 0;

  // 换挡灯计算：总共 15 颗 (5绿，5红，5蓝/紫)
  // 当转速超过怠速到红线时依次点亮
  const effectiveRange = redlineRpm - (idleRpm + 1500);
  const currentOverBase = Math.max(0, rpm - (idleRpm + 1500));
  const progress = isEngineOff
    ? 0
    : Math.min(1, currentOverBase / Math.max(1, effectiveRange));

  const totalLeds = 15;
  const litCount = isEngineOff ? 0 : Math.floor(progress * totalLeds);
  const isRedlineFlashing = !isEngineOff && progress >= 0.96;

  // 15 颗 LED 颜色类型定义
  // 0~4: 绿 (Green)
  // 5~9: 红 (Red)
  // 10~14: 蓝紫 (Blue)
  const leds = Array.from({ length: totalLeds }).map((_, i) => {
    let colorType: 'green' | 'red' | 'blue';
    if (i < 5) colorType = 'green';
    else if (i < 10) colorType = 'red';
    else colorType = 'blue';

    const isLit = !isEngineOff && (isRedlineFlashing ? true : i < litCount);

    return {
      index: i,
      colorType,
      isLit
    };
  });

  return (
    <div
      className={`${styles.shiftLightsContainer} ${isRedlineFlashing ? styles.flashingGroup : ''}`}
      aria-label="转速区间与断油提示灯"
      role="meter"
      aria-valuenow={rpm}
      aria-valuemin={idleRpm}
      aria-valuemax={redlineRpm}
    >
      <div className={styles.shiftLightsTrack}>
        {leds.map((led) => (
          <span
            key={led.index}
            className={`${styles.shiftLed} ${styles[led.colorType]} ${led.isLit ? styles.lit : ''}`}
          />
        ))}
      </div>
    </div>
  );
});
