import Link from 'next/link';
import { notFound } from 'next/navigation';
import { defaultF1Service } from '@/providers/f1/service';
import { PageHeading } from '@/components/page-heading';
export const dynamic='force-dynamic';
export default async function TeamDetailPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [teams,drivers]=await Promise.all([defaultF1Service.getConstructorStandings('2026'),defaultF1Service.getDriverStandings('2026')]);
 const team=teams.find(t=>t.teamId===id||t.nameEn.toLowerCase().includes(id.toLowerCase()));if(!team)notFound();const teamDrivers=drivers.filter(d=>d.teamId===team.teamId||d.team.includes(team.name));
 return <div className="page-shell page-team-detail"><div className="container"><Link className="breadcrumb" href="/teams">← 车队档案</Link><div className="profile-cover"><div><PageHeading category="2026 · 车队档案" title={team.name} description={team.nameEn}/><Link href="/ai" className="btn-primary">向 APEX AI 了解这支车队 ↗</Link></div><span className="profile-number mono" aria-label={`车队排名 ${team.rank}`}>P{team.rank}</span></div><dl className="profile-stats"><div><dt>车队积分榜排名</dt><dd>P{team.rank}</dd></div><div><dt>赛季总积分</dt><dd>{team.points}</dd></div><div><dt>分站冠军</dt><dd>{team.wins}</dd></div><div><dt>距榜首积分</dt><dd>{team.gap===0?'领跑':team.gap}</dd></div></dl>{teamDrivers.length>0&&<section className="team-driver-section"><div className="section-head"><div><h2>代表车手</h2><p>积分记录中的车队归属，不等同于当前签约阵容。</p></div></div><div className="team-grid">{teamDrivers.map(d=><Link className="team-driver-link" key={d.code} href={`/drivers/${d.driverId||d.code.toLowerCase()}`}><span className="mono">#{d.number}</span><div><strong>{d.name}</strong><small>{d.points} 分</small></div><span aria-hidden="true">↗</span></Link>)}</div></section>}</div></div>;
}
