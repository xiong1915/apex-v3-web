import Link from 'next/link';
import { RaceInteraction } from './race-interaction';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import type { F1Overview } from '@/lib/f1/types';
import { CircuitRegistry } from '@/lib/circuits/registry';
import { CircuitTrace } from './circuit-trace';
import { Countdown } from './countdown';
import { formatBeijingDisplay } from '@/lib/f1/time';

export function RaceCover({ overview, seasonEnded, serverTimeMs }: { overview: Pick<F1Overview, 'season'|'currentMeeting'|'nextSession'|'dataSource'|'updatedAt'|'isStale'|'upstreamSyncSuccess'>; seasonEnded: boolean; serverTimeMs?: number }) {
 const { currentMeeting: meeting, nextSession, season } = overview;
 const circuit = CircuitRegistry.getCircuit(meeting.circuitId, season, {meetingName:meeting.name});
 const target = nextSession?.targetUtcMs;
 const hasTime = target != null && Number.isFinite(target);
 return <>
  <LiquidGlass className="race-cover" id="race">
   <div className="race-cover-copy">
    <p className="race-cover-series"><i aria-hidden="true"/><span>{season} 世界一级方程式锦标赛</span></p>
    <div className="race-status"><i className="status-dot" aria-hidden="true"/><span>{nextSession?.status === 'IN_PROGRESS' ? '赛程计划时段' : seasonEnded ? '赛季回顾' : '下一站大奖赛'}</span><span>第 {meeting.round || '—'} 站 · {season} 赛季</span></div>
    <h1>{meeting.nameZh || meeting.name || '分站信息待同步'}</h1>
    <p className="race-cover-subtitle">{meeting.circuitName} · {meeting.locality} {meeting.country && `/ ${meeting.country}`}</p>
    <div className="race-cover-date"><span>{nextSession?.session?.startTimeUTC ? formatBeijingDisplay(nextSession.session.startTimeUTC) : '下一节时间待同步'}</span><small>北京时间 UTC+8</small></div>
    <div className="cover-countdown"><div className="cover-countdown-label"><span>{nextSession?.session?.name || '赛程状态'}</span><span>{nextSession?.status === 'IN_PROGRESS' ? '计划时段剩余时间' : '距离开赛'}</span></div>
     {hasTime ? <Countdown targetUtcMs={target} serverTimeMs={serverTimeMs} isInProgress={nextSession?.status === 'IN_PROGRESS'}/> : <p className="data-note">{seasonEnded ? '本赛季赛程已结束' : '开赛时间暂不可用，请稍后重试。'}</p>}
    </div>
    <div className="cover-actions"><Link className="btn-primary" href={meeting.round ? `/races/${meeting.round}` : '/races'}>分站详情 <span aria-hidden="true">↗</span></Link><a className="text-link" href="#weekend">周末赛程 ↓</a><Link className="text-link" href="/live">实时数据 ↗</Link></div>
   </div>
   <figure className="race-cover-visual"><div className="map-topline" style={{alignItems:"center"}}><div style={{display:"grid",gap:8}}><span>赛道档案</span><span>{circuit?.direction === 'anti-clockwise' ? '逆时针方向' : circuit?.direction === 'clockwise' ? '顺时针方向' : '方向待确认'}</span></div><RaceInteraction/></div><div className="cover-circuit"><CircuitTrace circuitId={meeting.circuitId} season={season} meetingName={meeting.name}/></div><figcaption className="map-caption"><div><strong>{meeting.circuitName}</strong><small>{circuit?.type === 'street' ? '市街赛道' : circuit?.type === 'hybrid' ? '混合赛道' : circuit ? '永久赛道' : '构型待同步'}</small></div>{circuit && <div className="map-specs"><div><strong>{circuit.lengthKm}</strong><small>公里</small></div><div><strong>{circuit.turns}</strong><small>弯角</small></div></div>}</figcaption></figure>
  </LiquidGlass>
  <div className="session-rail" id="weekend" aria-label="本分站完整周末赛程">{(meeting.sessions || []).map((session,i) => <LiquidGlass key={session.id || i} className={session.type === 'race' ? 'session-race' : ''}><strong>{session.name}{session.type==='race'&&<span className="session-label">正赛</span>}</strong><time dateTime={session.startTimeUTC}>{session.startTimeUTC ? formatBeijingDisplay(session.startTimeUTC) : '时间待定'}</time></LiquidGlass>)}{!meeting.sessions?.length && <div role="status">各节赛程暂不可用。</div>}</div>
  <div className="home-data-note"><p className="data-note">{overview.dataSource === 'live' ? '上游数据' : overview.dataSource === 'cache' ? '缓存数据' : overview.dataSource === 'lkg' ? '最近可用快照' : '数据暂不可用'} · 更新于 {formatBeijingDisplay(overview.updatedAt)}{overview.upstreamSyncSuccess === false ? ' · 最近同步失败，保留已有数据' : overview.isStale ? ' · 部分数据待更新' : ''}</p><Link href="/system" className="data-note">查看数据状态 ↗</Link></div>
 </>;
}
