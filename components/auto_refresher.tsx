'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresher({ intervalMs = 60000 }: { intervalMs?: number }) {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    function startTimer() {
      if (timerRef.current) clearInterval(timerRef.current);
      if (document.hidden || !navigator.onLine) return;
      timerRef.current = setInterval(() => {
        if (!document.hidden && navigator.onLine) {
          lastRefreshTimeRef.current = Date.now();
          router.refresh();
        }
      }, intervalMs);
    }

    function stopTimer() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden || !navigator.onLine) {
        stopTimer();
      } else {
        // 用户切回前台：若距离上次刷新已超过指定时间间隔，立即静默刷新并重启计时器
        const elapsed = Date.now() - lastRefreshTimeRef.current;
        if (elapsed >= intervalMs) {
          lastRefreshTimeRef.current = Date.now();
          router.refresh();
        }
        startTimer();
      }
    }

    startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleVisibilityChange);
    window.addEventListener('offline', stopTimer);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleVisibilityChange);
      window.removeEventListener('offline', stopTimer);
    };
  }, [router, intervalMs]);

  return null;
}
