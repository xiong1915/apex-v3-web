'use client';
import {teamStyle} from '@/lib/ui/team-colors';

import { useId, useState } from 'react';
import Link from 'next/link';
import { standingRatio } from '@/lib/ui/motion-policy';

export type BattleEntry = { id: string; rank: number; name: string; detail: string; points: number; href: string };
export function ChampionshipBattle({ drivers, teams }: { drivers: BattleEntry[]; teams: BattleEntry[] }) {
  const [tab, setTab] = useState(0);
  const id = useId();
  const entries = tab === 0 ? drivers : teams;
  return <div className="battle-board">
    <div className="battle-tabs" role="tablist" aria-label="锦标赛积分类型">
      {['车手锦标赛', '车队锦标赛'].map((label, index) => <button key={label} type="button" role="tab" id={`${id}-tab-${index}`} aria-selected={tab === index} aria-controls={`${id}-panel`} tabIndex={tab === index ? 0 : -1}
        onClick={() => setTab(index)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - tab;
          setTab(next);
          document.getElementById(`${id}-tab-${next}`)?.focus();
        }}>{label}<span aria-hidden="true">0{index + 1}</span></button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
      {entries.length === 0 ? <p className="race-empty">积分暂不可用。取得真实数据后将在这里展示。</p> : <ol className="battle-list" key={tab}>
        {entries.map(entry => <li key={entry.id}>
          <Link href={entry.href} className="battle-row" style={teamStyle(tab===0?entry.detail:entry.id+" "+entry.name)}>
            <span className="battle-rank">{String(entry.rank).padStart(2, '0')}</span>
            <span className="battle-name"><strong>{entry.name}</strong><small>{entry.detail}</small><span className="battle-track" aria-hidden="true"><i style={{ transform: `scaleX(${standingRatio(entry.points, entries[0]?.points)})` }} /></span></span>
            <span className="battle-points">{entry.points}<small>PTS</small></span>
          </Link>
        </li>)}
      </ol>}
    </div>
  </div>;
}
