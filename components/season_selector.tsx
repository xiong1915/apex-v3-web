// components/season_selector.tsx
'use client';

import React, { useTransition, useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface SeasonSelectorProps {
  currentSeason: string;
  seasons: string[];
  baseUrl?: string;
}

export function SeasonSelector({
  currentSeason,
  seasons,
  baseUrl = '/races'
}: SeasonSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectId = useId();

  const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === currentSeason) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('season', selected);
    startTransition(() => router.push(`${baseUrl}?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className="season-control" aria-busy={isPending}>
      <label
        htmlFor={selectId}
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--text-secondary, #94a3b8)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
        选择赛季：
      </label>
      <div style={{ position: 'relative' }}>
        <select
          id={selectId}
          name="season"
          disabled={isPending}
          value={currentSeason}
          onChange={handleSeasonChange}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'var(--bg-secondary, #18181b)',
            color: 'var(--text-primary, #ffffff)',
            border: '1px solid var(--line-dark, rgba(255, 255, 255, 0.15))',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 32px 6px 14px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            outline: 'none',
            boxShadow: 'none'
          }}
        >
          {seasons.map(s => (
            <option key={s} value={s} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
              {s} 赛季 {s === '2026' ? '(当前)' : ''}
            </option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            fontSize: '10px',
            color: 'var(--text-muted, #71717a)'
          }}
        >
          ▼
        </span>
      </div>
      <span className="season-feedback" role="status">{isPending ? '正在切换赛季…' : ''}</span>
    </div>
  );
}
