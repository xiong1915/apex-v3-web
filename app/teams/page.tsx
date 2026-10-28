import Link from 'next/link';
import { defaultF1Service } from '@/providers/f1/service';
import { PageHeading } from '@/components/page-heading';
export const dynamic='force-dynamic';
export default async function TeamsPage(){
 const teams=await defaultF1Service.getConstructorStandings('2026');
 return <div className="page-shell page-teams"><div className="container"><PageHeading category="2026 · 车队档案" title="车队档案" description="车队积分、分站胜绩与制造商档案。" meta={<span>共 {teams.length} 支车队</span>}/>
 {!teams.length&&<div className="empty-state" role="status">车队数据暂不可用，请稍后重试。</div>}
 <div className="team-grid">{teams.map(t=><Link className="team-tile" key={t.teamId} href={`/teams/${t.teamId}`}><div className="team-tile-top"><span className="rank-chip">P{t.rank}</span><span aria-hidden="true" className="tile-arrow">↗</span></div><h2>{t.name.replace(/\s*[（(][^）)]*[）)]\s*$/,'')}</h2><p>{t.nameEn}</p><div className="team-stat-row"><div><strong>{t.points}</strong><small>赛季积分</small></div><div><strong>{t.wins}</strong><small>分站冠军</small></div><div><strong>{t.gap===0?'领跑':t.gap}</strong><small>{t.gap===0?'车队积分榜首':'距榜首积分'}</small></div></div></Link>)}</div>
 </div></div>;
}
