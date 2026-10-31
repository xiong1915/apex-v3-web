import { Paddock } from '@/components/paddock';
import { RaceCockpit } from '@/components/race-cockpit';
import { Suspense } from 'react';
import Link from 'next/link';
import { defaultF1Service } from '@/providers/f1/service';
import { RaceCover } from '@/components/race-cover';
import { ChampionshipBattle } from '@/components/championship-battle';
import { CircuitTrace } from '@/components/circuit-trace';
import { AISearchBox, AIAccountHint } from '@/components/ai_search_box';
import { AutoRefresher } from '@/components/auto_refresher';
import { formatBeijingDisplay } from '@/lib/f1/time';
import { RaceStateService } from '@/lib/f1/race-state';

export const dynamic = 'force-dynamic';
async function MyPaddock() {
 const [teams,drivers,last]=await Promise.all([defaultF1Service.getConstructorStandingsResult(),defaultF1Service.getDriverStandingsResult(),defaultF1Service.getLastRaceResultResult()]);
 const recent=last.data?await defaultF1Service.getRaceResult(last.data.season,last.data.round):[];
 const source=(value:string)=>({live:'上游数据',cache:'缓存快照',lkg:'上次可用快照',unavailable:'暂不可用'}[value]||'来源待核实');
 const note=`车队积分：${source(teams.source)}${teams.fetchedAt?` · ${formatBeijingDisplay(teams.fetchedAt)}`:''}；车手积分：${source(drivers.source)}${drivers.fetchedAt?` · ${formatBeijingDisplay(drivers.fetchedAt)}`:''}。最近正赛：${source(last.source)}。`;
 return <Paddock teams={teams.data} drivers={drivers.data} recent={recent} recentRound={last.data?.round} note={note}/>;
}
async function Cockpit() {
 const {currentMeeting:meeting}=await defaultF1Service.getRaceCover();
 const now=Date.now();
 const due=(type:string)=>meeting.sessions.some(session=>session.type===type&&Date.parse(session.startTimeUTC)<=now);
 const [race,qualifying,sprint]=await Promise.all([due('race')?defaultF1Service.getRaceResult(meeting.season,meeting.round):[],due('qualifying')?defaultF1Service.getQualifyingResult(meeting.season,meeting.round):[],due('sprint')?defaultF1Service.getSprintResult(meeting.season,meeting.round):[]]);
 return <RaceCockpit meeting={meeting} race={race} qualifying={qualifying} sprint={sprint}/>;
}
async function Cover() {
 const overview = await defaultF1Service.getRaceCover();
 return <RaceCover overview={overview} serverTimeMs={Date.now()} seasonEnded={overview.totalRounds>0 && overview.currentMeeting.round===overview.totalRounds && RaceStateService.evaluateMeeting(overview.currentMeeting).state==='WEEKEND_FINISHED'}/>;
}
async function Championship() {
 const [drivers,teams]=await Promise.all([defaultF1Service.getDriverStandingsResult(),defaultF1Service.getConstructorStandingsResult()]);
 const driverStandings=drivers.data,constructorStandings=teams.data,season=String(new Date().getUTCFullYear());
 return <>  <section className="editorial-section paper-section"><div className="container championship-spread"><div className="championship-context"><span className="eyebrow">锦标赛 · {season}</span><h2>积分背后的较量</h2><p>车手与车队积分，呈现每一站之后的争冠格局。所有排名依据当前可用数据，不推测未公布的结果。</p><Link href="/standings" className="text-link">完整积分榜 ↗</Link><p className="data-note">{driverStandings[0]?.officialRound?`第 ${driverStandings[0].officialRound} 站积分快照；场次范围请查看完整积分榜`:'积分统计范围待核实'}</p></div><ChampionshipBattle drivers={driverStandings.slice(0,5).map(d=>({id:d.driverId||d.code,rank:d.rank,name:d.name,detail:d.team,points:d.points,href:`/drivers/${d.driverId||d.code.toLowerCase()}`}))} teams={constructorStandings.slice(0,5).map(t=>({id:t.teamId,rank:t.rank,name:t.name,detail:t.nameEn,points:t.points,href:`/teams/${t.teamId}`}))}/></div></section></>;
}
async function CalendarAndTools() {
 const [cover,calendar]=await Promise.all([defaultF1Service.getRaceCover(),defaultF1Service.getCalendar()]);
 const meeting=cover.currentMeeting,season=cover.season;
 const upcoming=calendar.filter(r=>r.round>meeting.round).slice(0,3);
 return <>
  <section className="editorial-section"><div className="container"><div className="section-head"><div><span className="eyebrow">{season} 赛季日历</span><h2>接下来的比赛</h2><p>开赛时间统一为北京时间。</p></div><Link className="text-link" href="/races">全部 {calendar.length} 站 ↗</Link></div><div className="season-preview">{upcoming.map(race=><Link key={race.round} href={`/races/${race.round}`}><span className="race-round">{String(race.round).padStart(2,'0')}</span><div><h3>{race.nameZh||race.name}</h3><p>{race.circuitName}</p><time>{race.raceStartUTC?formatBeijingDisplay(race.raceStartUTC):'正赛时间待定'}</time></div></Link>)}{!upcoming.length&&<p className="data-note">{calendar.length?'本分站之后暂无后续赛程，历史比赛请查看完整赛历。':'赛历暂不可用，请稍后重试。'}</p>}</div></div></section>
  <section className="editorial-section" style={{paddingTop:0}}><div className="container profiles-spread"><Link className="profile-feature" href="/drivers"><div><span className="eyebrow">车手档案</span><h3>了解每一位竞争者</h3><p>赛季积分、车手表现与所属车队 ↗</p></div><span className="feature-index" aria-hidden="true">01</span></Link><Link className="profile-feature" href="/teams"><div><span className="eyebrow">车队档案</span><h3>从制造商到领奖台</h3><p>车队阵容、总积分与分站胜绩 ↗</p></div><span className="feature-index" aria-hidden="true">02</span></Link></div></section>
  <section className="editorial-section" style={{paddingTop:0}}><div className="container tools-spread"><div className="tool-ai"><span className="eyebrow">tikeai · 赛事分析</span><h2>把问题交给你的赛事助手</h2><p>赛程、积分、车手与比赛规则。在可追溯的数据中理解比赛。</p><AISearchBox/><AIAccountHint/></div><div className="tool-live"><span className="eyebrow">tikeai LIVE TIMING · 实时数据</span><h2>跟随每一节比赛</h2><p>赛程、北京时间倒计时与已收录成绩。完整实时计时的可用范围会明确标注。</p><Link prefetch={false} href="/live" className="text-link">进入实时赛事中心 ↗</Link><div className="live-circuit-preview" aria-hidden="true"><CircuitTrace circuitId={meeting.circuitId} season={season} meetingName={meeting.name}/></div></div></div></section>
</>;
}
async function PreviousRace() {
 const previousRace=(await defaultF1Service.getLastRaceResultResult()).data;
 return <>  {previousRace&&<section className="editorial-section section-secondary"><div className="container"><div className="section-head"><div><span className="eyebrow">上一站回顾</span><h2>{previousRace.nameZh||previousRace.name}</h2></div></div><div className="home-history"><div><small>正赛冠军</small><strong>{previousRace.winner?.name||'暂无数据'}</strong><span>{previousRace.winner?.team}</span></div><div><small>{previousRace.pole?'杆位得主':previousRace.startingGridP1?'正赛发车首位（非杆位确认）':'排位首位（杆位待核实）'}</small><strong>{previousRace.pole?.name||previousRace.startingGridP1?.name||previousRace.qualifyingP1?.name||'暂无数据'}</strong><span>{previousRace.pole?.team||previousRace.startingGridP1?.team}</span></div><div><small>本场最快圈速</small><strong>{previousRace.fastestLap?.name||'暂无数据'}</strong><span>{previousRace.fastestLap?.lapTime}{previousRace.fastestLap?.lap?<> · 第 {previousRace.fastestLap.lap} 圈</>:null}</span></div></div><div className="source-links">{previousRace.sourceUrls?.raceResult&&<a target="_blank" rel="noopener noreferrer" href={previousRace.sourceUrls.raceResult}>官方正赛赛果 ↗</a>}{previousRace.sourceUrls?.qualifying&&<a target="_blank" rel="noopener noreferrer" href={previousRace.sourceUrls.qualifying}>官方排位成绩 ↗</a>}{previousRace.sourceUrls?.fastestLaps&&<a target="_blank" rel="noopener noreferrer" href={previousRace.sourceUrls.fastestLaps}>官方最快圈成绩 ↗</a>}</div></div></section>}</>;
}
function CoverPending(){return <div className="home-loading" role="status"><div className="race-cover"><div className="race-cover-copy"><div className="race-status">分站数据同步中</div><h1>下一站大奖赛</h1><p className="race-cover-subtitle">正在读取真实赛程与赛道信息…</p><div className="cover-countdown"><p className="data-note">开赛时间以实际公布的赛程为准。</p></div><div className="cover-actions"><Link href="/races" className="btn-primary">查看赛历 ↗</Link></div></div><div className="race-cover-visual" style={{minHeight:380,display:'grid',placeItems:'center'}}><span className="data-note" style={{color:'#62656b'}}>赛道档案加载中</span></div></div></div>}
export default function HomePage(){return <div className="editorial-home"><div className="container"><div className="home-intro"><span><i aria-hidden="true"/>2026 世界一级方程式锦标赛</span><span className="mono">赛事 · 数据 · 分析</span></div><Suspense fallback={<CoverPending/>}><Cover/></Suspense></div><Suspense fallback={<div className="container home-pending-sections" role="status">正在准备我的围场…</div>}><MyPaddock/></Suspense><Suspense fallback={null}><Cockpit/></Suspense><Suspense fallback={<div className="home-pending-sections" role="status">正在同步赛季积分…</div>}><Championship/></Suspense><Suspense fallback={null}><CalendarAndTools/></Suspense><Suspense fallback={null}><PreviousRace/></Suspense><AutoRefresher/></div>}
