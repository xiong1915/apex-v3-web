import { Suspense } from 'react';
import Link from 'next/link';
import { defaultF1Service } from '@/providers/f1/service';
import { Countdown } from '@/components/countdown';
import { CircuitTrace } from '@/components/circuit-trace';
import { RaceExperience } from '@/components/race-experience';
import { ChampionshipBattle } from '@/components/championship-battle';
import { AISearchBox } from '@/components/ai_search_box';
import { LazySimulator } from '@/components/lazy_simulator';
import { AutoRefresher } from '@/components/auto_refresher';
import { formatBeijingDisplay } from '@/lib/f1/time';
import { CircuitRegistry } from '@/lib/circuits/registry';
import { showSeasonReview } from '@/lib/ui/race-presentation';
import { RaceStateService } from '@/lib/f1/race-state';

export const dynamic = 'force-dynamic';

function loadHomeData() { return Promise.all([defaultF1Service.getOverview(), defaultF1Service.getCalendar('2026')]); }
type HomeData = ReturnType<typeof loadHomeData>;

async function HomeSections({ data }: { data: HomeData }) {
  const [overview, calendar] = await data;
  const { currentMeeting: meeting, nextSession, driverStandings, constructorStandings, previousRace, season } = overview;
  const circuit = CircuitRegistry.getCircuit(meeting.circuitId, season);
  const hasCountdown = nextSession?.targetUtcMs != null && Number.isFinite(nextSession.targetUtcMs);
  const upcoming = calendar.filter(r => r.round > meeting.round).sort((a, b) => a.round - b.round).slice(0, 3);
  const ended = showSeasonReview(meeting.round, calendar.map(r => r.round), RaceStateService.evaluateMeeting(meeting).state === 'WEEKEND_FINISHED');
  const sourceLabel = overview.dataSource === 'live' ? '上游数据' : overview.dataSource === 'cache' ? '缓存数据' : overview.dataSource === 'lkg' ? '最近可用快照' : '数据暂不可用';
  return <>
    <section className="lo-section weekend-section" id="weekend" data-reveal><div className="container">
      <div className="section-kicker"><span>01 / RACE WEEKEND</span><span>{season} WORLD CHAMPIONSHIP</span></div>
      <div className="weekend-layout"><div className="section-intro"><span className="eyebrow">NEXT GRAND PRIX</span><h2>下一个弯角。<br /><em>下一场较量。</em></h2><p>{meeting.nameZh || meeting.name}<br />{meeting.circuitName}</p>
        <div className="circuit-specs">{circuit && <><div><strong>{circuit.lengthKm}<small>KM</small></strong><span>赛道长度</span></div><div><strong>{circuit.turns}</strong><span>弯角数量</span></div></>}{meeting.specs?.laps && <div><strong>{meeting.specs.laps}</strong><span>正赛圈数</span></div>}</div>
        <Link href={meeting.round ? `/races/${meeting.round}` : '/races'} className="text-link">完整分站档案 ↗</Link>
      </div><div className="weekend-schedule"><div className="schedule-caption mono"><span>SESSION</span><span>北京时间 / UTC+8</span></div>
        {(meeting.sessions || []).map((session, i) => <div className={`schedule-row ${session.type === 'race' ? 'schedule-race' : ''}`} key={session.id || i}><span className="schedule-index mono">0{i + 1}</span><div><strong>{session.name}</strong><small>{session.nameEn}</small></div><time dateTime={session.startTimeUTC}>{session.startTimeUTC ? formatBeijingDisplay(session.startTimeUTC) : '待定'}</time></div>)}
        {!meeting.sessions?.length && <p className="race-empty">本分站各节时间暂不可用，请稍后重试。</p>}
        <p className="data-note">{sourceLabel} · 更新于 {formatBeijingDisplay(overview.updatedAt)}{overview.upstreamSyncSuccess === false ? ' · 最近同步失败，保留已有数据' : overview.isStale ? ' · 部分数据待更新' : ''}</p>
      </div></div>
    </div></section>

    <section className="lo-section championship-section" id="standings" data-reveal><div className="container">
      <div className="section-kicker"><span>02 / CHAMPIONSHIP BATTLE</span><span>EVERY POINT COUNTS</span></div>
      <div className="championship-layout"><div className="section-intro"><span className="eyebrow">THE FIGHT FOR THE CROWN</span><h2>毫厘之间。<br /><em>冠军之争。</em></h2><p>车手与车队，同一场角逐。<br />从每一站积分，看懂争冠格局。</p><Link href="/standings" className="text-link">查看完整积分榜 ↗</Link><p className="data-note">{overview.standingsCutoffDesc || '积分统计范围待核实'}</p></div>
      <ChampionshipBattle drivers={driverStandings.slice(0, 5).map(d => ({ id: d.driverId || d.code, rank: d.rank, name: d.name, detail: d.team, points: d.points, href: `/drivers/${d.driverId || d.code.toLowerCase()}` }))} teams={constructorStandings.slice(0, 5).map(t => ({ id: t.teamId, rank: t.rank, name: t.name, detail: t.nameEn, points: t.points, href: `/teams/${t.teamId}` }))} />
      </div></div></section>

    <section className="lo-section universe-section" id="next-races" data-reveal><div className="container">
      <div className="section-kicker"><span>03 / RACE UNIVERSE</span><span>BEYOND THE FINISH LINE</span></div>
      <div className="section-title-row"><h2 className="display-title">一整个世界。<br /><span>为速度而生。</span></h2><p>从起点到终点，<br />探索赛道背后的每一个名字。</p></div>
      <div className="universe-grid"><Link className="universe-feature" href="/races"><span className="eyebrow">THE CALENDAR / {calendar.length} GRANDS PRIX</span><div className="universe-track"><CircuitTrace circuitId={meeting.circuitId} season={season} /></div><div><h3>世界是我们的赛道。</h3><span>探索全季赛历 <b aria-hidden="true">↗</b></span></div></Link><div className="universe-side"><Link href="/drivers" className="universe-tile"><span className="eyebrow">THE DRIVERS</span><span className="tile-number" aria-hidden="true">01—</span><h3>极限的驾驭者。</h3><span>探索车手 ↗</span></Link><Link href="/teams" className="universe-tile"><span className="eyebrow">THE CONSTRUCTORS</span><span className="tile-number" aria-hidden="true">02—</span><h3>速度的创造者。</h3><span>探索车队 ↗</span></Link></div></div>
      <div className="upcoming-strip">{upcoming.map(race => <Link key={race.round} href={`/races/${race.round}`}><span className="eyebrow">ROUND {String(race.round).padStart(2, '0')}</span><strong>{race.nameZh || race.name}</strong><time>{race.raceStartUTC ? formatBeijingDisplay(race.raceStartUTC) : '时间待定'}</time><span aria-hidden="true">↗</span></Link>)}{!upcoming.length && <p className="data-note">{ended ? '本赛季已结束，完整赛果请前往赛历。' : calendar.length ? '本分站为收官战。' : '后续赛历暂不可用。'}</p>}</div>
    </div></section>

    <section className="lo-section intelligence-section" id="ai" data-reveal><div className="container intelligence-layout"><div><span className="eyebrow">04 / APEX INTELLIGENCE</span><h2>不止看懂比赛。<br /><em>更懂为什么。</em></h2><p>从轮胎策略到积分规则，<br />把你的好奇心交给 APEX AI。</p><div className="intelligence-tags"><span>赛事解读</span><span>策略问答</span><span>来源追溯</span></div></div><div className="intelligence-input"><span className="intelligence-mark" aria-hidden="true">✳</span><span className="eyebrow">YOUR RACE ENGINEER, ONE QUESTION AWAY.</span><AISearchBox /><p className="data-note">使用原有 AI 服务 · 登录后开启对话</p></div></div></section>

    <section className="lo-section replay-section" data-reveal><div className="container"><div className="section-kicker"><span>05 / APEX REPLAY</span><span>A DIFFERENT POINT OF VIEW</span></div><div className="replay-promo"><div><span className="eyebrow">BACK TO THE APEX</span><h2>重返每一个<br /><em>关键瞬间。</em></h2><p>切换视角，追踪车手。<br />在动态赛道与遥测中，重新理解比赛。</p><Link href="/replay" className="btn-primary">进入回放控制台 ↗</Link></div><div className="telemetry-art" aria-hidden="true"><div className="telemetry-head mono"><span>APEX / TELEMETRY</span><span>REPLAY VIEW</span></div><CircuitTrace circuitId={meeting.circuitId} season={season} /><div className="telemetry-wave"><svg viewBox="0 0 600 80"><path d="M0 65H40L60 25H120L140 65H180L200 12H280L300 65H340L355 35H410L430 65H460L480 8H550L570 65H600" fill="none" stroke="currentColor" strokeWidth="2" /></svg></div><span className="mono">装饰示意 / 非实时遥测</span></div></div></div></section>

    {previousRace && <section className="lo-section last-race-section" id="last-race" data-reveal><div className="container"><span className="eyebrow">LAST TIME OUT / 上一站回顾</span><h2>{previousRace.nameZh || previousRace.name}</h2><div className="last-race-grid"><div><small>分站正赛冠军</small><strong>{previousRace.winner?.name || '暂无数据'}</strong><span>{previousRace.winner?.team}</span></div><div><small>{previousRace.pole ? '杆位得主' : previousRace.startingGridP1 ? '正赛发车首位（非杆位确认）' : '排位首位（杆位待核实）'}</small><strong>{previousRace.pole?.name || previousRace.startingGridP1?.name || previousRace.qualifyingP1?.name || '暂无数据'}</strong></div><div><small>本场最快圈速</small><strong>{previousRace.fastestLap?.name || '暂无数据'}</strong><span>{previousRace.fastestLap?.lapTime}{previousRace.fastestLap?.lap ? <> (第 {previousRace.fastestLap.lap} 圈)</> : ''}</span></div></div>{previousRace.sourceUrls?.qualifying && <a href={previousRace.sourceUrls.qualifying} target="_blank" rel="noopener noreferrer" className="text-link">官方排位成绩 ↗</a>} {previousRace.sourceUrls?.fastestLaps && <a href={previousRace.sourceUrls.fastestLaps} target="_blank" rel="noopener noreferrer" className="text-link">官方最快圈成绩 ↗</a>} {previousRace.sourceUrls?.raceResult && <a href={previousRace.sourceUrls.raceResult} target="_blank" rel="noopener noreferrer" className="text-link">官方正赛赛果 ↗</a>}</div></section>}
    <section className="lo-section simulator-section" id="simulator" data-reveal><div className="container"><LazySimulator drivers={driverStandings} isSprintWeekend={Boolean(meeting.isSprintWeekend)} isSprintPending={overview.canSimulateSprint === true} available={overview.canSimulateRace === true} /></div></section>
  </>;
}

function HeroSkeleton() {
  return <><div className="hero-circuit" aria-hidden="true"><div className="hero-placeholder-track" /></div><div className="hero-race-info hero-race-pending" role="status"><span className="eyebrow">NEXT GRAND PRIX</span><h2>下一站，正在接近。</h2><p>正在连接赛事数据…</p><div className="hero-actions"><Link href="/races" className="btn-primary">探索赛历 ↗</Link><Link href="/ai" className="text-link">APEX AI ↗</Link><Link href="/replay" className="text-link">赛事回放 ↗</Link></div></div><div className="hero-countdown"><div className="timing-label"><span className="eyebrow">赛程同步中</span><span className="mono">BEIJING / UTC+8</span></div><p className="race-empty">连接真实赛事，等待灯灭。</p><p className="timing-date">开赛时间以实际赛程为准</p></div></>;
}
async function HeroRaceContent({ data }: { data: HomeData }) {
  const [overview, calendar] = await data;
  const { currentMeeting: meeting, nextSession, season } = overview;
  const circuit = CircuitRegistry.getCircuit(meeting.circuitId, season);
  const hasCountdown = nextSession?.targetUtcMs != null && Number.isFinite(nextSession.targetUtcMs);
  const ended = showSeasonReview(meeting.round, calendar.map(r => r.round), RaceStateService.evaluateMeeting(meeting).state === 'WEEKEND_FINISHED');
  return <>        <div className="hero-circuit"><CircuitTrace circuitId={meeting.circuitId} season={season} /><span className="circuit-caption mono">{meeting.circuitName || '赛道信息待同步'}<br /><span>{circuit ? `${circuit.lengthKm} KM / ${circuit.turns} TURNS` : 'LAYOUT UNAVAILABLE'}</span></span></div>
        <div className="hero-race-info">
          <div className="race-label"><span className="eyebrow">{nextSession?.status === 'IN_PROGRESS' ? 'RACE WEEKEND / 进行中' : ended ? 'SEASON FINALE / 赛季回顾' : 'NEXT GRAND PRIX / 下一站'}</span><span className="round-tag mono">{meeting.round > 0 ? `ROUND ${String(meeting.round).padStart(2, '0')}` : 'SYNCING'}</span></div>
          <h2>{meeting.nameZh || meeting.name || '下一站赛事待同步'}</h2>
          <p>{meeting.locality} {meeting.country && `/ ${meeting.country}`}<span>{meeting.isSprintWeekend ? '冲刺赛周末' : '大奖赛周末'}</span></p>
          <div className="hero-actions"><a href="#weekend" className="btn-primary">探索赛事 <span aria-hidden="true">↗</span></a><Link href="/ai" className="text-link">APEX AI ↗</Link><Link href="/replay" className="text-link">赛事回放 ↗</Link></div>
        </div>
        <div className="hero-countdown">
          <div className="timing-label"><span className="eyebrow">{nextSession?.session?.name || '赛程状态'}</span><span className="mono">BEIJING / UTC+8</span></div>
          {hasCountdown ? <Countdown targetUtcMs={nextSession!.targetUtcMs!} serverTimeMs={Date.now()} isInProgress={nextSession?.status === 'IN_PROGRESS'} /> : <p className="race-empty">{ended ? '本赛季赛程已结束' : '开赛时间待同步'}</p>}
          <p className="timing-date mono">{nextSession?.session?.startTimeUTC ? formatBeijingDisplay(nextSession.session.startTimeUTC) : '以实际公布的赛程为准'}</p>
        </div>
</>;
}
export default function HomePage() {
 const data = loadHomeData();
 return <RaceExperience><section className="lo-hero" id="race"><div className="hero-grid" aria-hidden="true" /><div className="container hero-inner">
  <div className="hero-topline"><span className="eyebrow"><i /> FORMULA 1 / 2026</span><span className="mono">THE RACE STARTS HERE</span></div>
  <div className="hero-heading"><h1>LIGHTS<br /><span>OUT.</span></h1><p>每一秒，<br />都值得全情投入。</p></div>
  <Suspense fallback={<HeroSkeleton />}><HeroRaceContent data={data} /></Suspense>
  <div className="hero-bottom mono"><span>F1 DATA. RACE INTELLIGENCE. PURE PASSION.</span><a href="#weekend">SCROLL TO EXPLORE ↓</a></div>
 </div></section><Suspense fallback={<div className="home-data-pending" role="status">正在同步赛事与积分…</div>}><HomeSections data={data} /></Suspense><AutoRefresher /></RaceExperience>;
}
