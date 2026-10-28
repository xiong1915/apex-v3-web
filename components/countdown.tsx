'use client';
import { useEffect, useState, useCallback } from 'react';
import { RaceStateService } from '@/lib/f1/race-state';

export function Countdown({ targetUtcMs, serverTimeMs=targetUtcMs, isInProgress }: { targetUtcMs: number; serverTimeMs?: number; isInProgress?: boolean }) {
  const [delta, setDelta] = useState(() => RaceStateService.calculateCountdown(targetUtcMs, serverTimeMs));

  const update = useCallback(() => {
    if (typeof document !== 'undefined' && !document.hidden) {
      setDelta(RaceStateService.calculateCountdown(targetUtcMs, Date.now()));
    }
  }, [targetUtcMs]);

  useEffect(() => {
    update();
    const timer = setInterval(update, 1000);
    const onWakeup = () => update();

    document.addEventListener('visibilitychange', onWakeup);
    window.addEventListener('pageshow', onWakeup);
    window.addEventListener('focus', onWakeup);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWakeup);
      window.removeEventListener('pageshow', onWakeup);
      window.removeEventListener('focus', onWakeup);
    };
  }, [update]);

  return (
    <div className="race-countdown">
      {isInProgress && <p className="countdown-live">计划时段倒计时 · 实际状态以官方为准</p>}
      <div className="countdown-grid">
        {[[delta.days, '天'], [delta.hours, '小时'], [delta.mins, '分'], [delta.secs, '秒']].map(([value, label]) => (
          <div className="countdown-unit" key={label}>
            <strong className="countdown-number tabular-nums">
              <span key={value}>{String(value).padStart(2, '0')}</span>
            </strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
