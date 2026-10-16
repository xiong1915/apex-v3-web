import Link from 'next/link';
import { defaultF1Service } from '@/providers/f1/service';
import { PageHeading } from '@/components/page-heading';
import { SeasonSelector } from '@/components/season_selector';
import { CircuitTrace } from '@/components/circuit-trace';
import { formatBeijingDisplay } from '@/lib/f1/time';
export const dynamic='force-dynamic';
export default async function RacesPage({searchParams}:{searchParams:Promise<{season?:string}>}){
 const {season:rawSeason}=(await searchParams)||{};const season=rawSeason||'2026';
 const [seasons,calendar,overview]=await Promise.all([defaultF1Service.getSeasons(),defaultF1Service.getCalendar(season),defaultF1Service.getOverview(season)]);
 const historical=Number(season)<new Date().getUTCFullYear();
 return <div className="page-shell page-races"><div className="container"><PageHeading category={`${season} · 赛季日历`} title="每一站，都是新的故事" description={`收录 ${calendar.length} 站大奖赛，含 ${calendar.filter(r=>r.isSprintWeekend).length} 站冲刺周末。时间统一为北京时间。`} actions={<SeasonSelector currentSeason={season} seasons={seasons} baseUrl="/races"/>} meta={<span>更新于 {formatBeijingDisplay(overview.updatedAt)}{overview.upstreamSyncSuccess===false?' · 最近同步失败，保留已有数据':''}</span>}/>
 {!calendar.length?<div className="empty-state" role="status"><h2>该赛季暂无赛历数据</h2><p>可切换其他赛季查看。</p><Link href="/races?season=2026" className="btn-primary">返回当前赛季</Link></div>:<div className="calendar-grid">{calendar.map(race=><Link className="calendar-tile" key={race.meetingId||race.round} href={`/races/${race.round}?season=${season}`}><div className="calendar-tile-top"><span className="calendar-round mono">{String(race.round).padStart(2,'0')}</span><span className="badge-pill">{race.isSprintWeekend?'冲刺周末':historical?'历史赛程':'大奖赛'}</span></div><div className="calendar-track"><CircuitTrace circuitId={race.circuitId} season={season}/></div><h2>{race.nameZh||race.name}</h2><p>{race.circuitName}</p><div className="calendar-tile-bottom"><time dateTime={race.raceStartUTC}>{race.raceStartUTC?formatBeijingDisplay(race.raceStartUTC):race.sessions?.[0]?.startTimeUTC?formatBeijingDisplay(race.sessions[0].startTimeUTC):'日期记录暂缺'}</time><span aria-hidden="true">↗</span></div></Link>)}</div>}
 </div></div>;
}
