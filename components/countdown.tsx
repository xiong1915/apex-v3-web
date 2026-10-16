'use client';
import { useEffect, useState } from 'react';
import { RaceStateService } from '@/lib/f1/race-state';
export function Countdown({ targetUtcMs, serverTimeMs, isInProgress }: { targetUtcMs: number; serverTimeMs?: number; isInProgress?: boolean }) {
  const [skew] = useState(() => serverTimeMs ? Date.now() - serverTimeMs : 0);
  const [delta, setDelta] = useState(() => RaceStateService.calculateCountdown(targetUtcMs, serverTimeMs ?? Date.now()));
  useEffect(() => {
    const update = () => { if (!document.hidden) setDelta(RaceStateService.calculateCountdown(targetUtcMs, Date.now() - skew)); };
    update();
    const timer = setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [targetUtcMs, skew]);
  return <div className="race-countdown">
    {isInProgress && <p className="countdown-live">进行中 · 预计剩余时间</p>}
    <div className="countdown-grid">{[[delta.days,'天'],[delta.hours,'小时'],[delta.mins,'分'],[delta.secs,'秒']].map(([value,label]) => <div className="countdown-unit" key={label}><strong className="countdown-number tabular-nums"><span key={value}>{String(value).padStart(2,'0')}</span></strong><small>{label}</small></div>)}</div>
  </div>;
}
