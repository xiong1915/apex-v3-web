// components/rev/ShiftLights.tsx
'use client';

import React from 'react';
import styles from './rev.module.css';

interface ShiftLightsProps {
  rpm: number;
  redlineRpm: number;
  idleRpm: number;
}

export function ShiftLights({ rpm, redlineRpm, idleRpm }: ShiftLightsProps) {
  // 换挡灯计算：总共 15 颗 (5绿，5红，5蓝/紫)
  // 当转速超过怠速到红线时依次点亮
  const effectiveRange = redlineRpm - (idleRpm + 2000);
  const currentOverBase = Math.max(0, rpm - (idleRpm + 2000));
  const progress = Math.min(1, currentOverBase / Math.max(1, effectiveRange));

  const totalLeds = 15;
  const litCount = Math.floor(progress * totalLeds);
  const isRedlineFlashing = progress >= 0.96;

  // 15 颗 LED 颜色类型定义
  // 0~4: 绿 (Green)
  // 5~9: 红 (Red)
  // 10~14: 蓝紫 (Blue)
  const leds = Array.from({ length: totalLeds }).map((_, i) => {
    let colorType: 'green' | 'red' | 'blue';
    if (i < 5) colorType = 'green';
    else if (i < 10) colorType = 'red';
    else colorType = 'blue';

    const isLit = isRedlineFlashing ? true : i < litCount;

    return {
      index: i,
      colorType,
      isLit
    };
  });

  return (
    <div
      className={`${styles.shiftLightsContainer} ${isRedlineFlashing ? styles.flashingGroup : ''}`}
      aria-label="换挡指示灯"
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
}
