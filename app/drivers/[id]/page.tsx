import Link from 'next/link';
import {AILink} from '@/components/ai-link';
import { notFound } from 'next/navigation';
import { defaultF1Service } from '@/providers/f1/service';
import { PageHeading } from '@/components/page-heading';
export const dynamic='force-dynamic';
export default async function DriverDetailPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const drivers=await defaultF1Service.getDriverStandings('2026');const driver=drivers.find(d=>d.driverId===id||d.code.toLowerCase()===id.toLowerCase());if(!driver)notFound();
 return <div className="page-shell page-driver-detail"><div className="container"><Link className="breadcrumb" href="/drivers">← 车手档案</Link><div className="profile-cover"><div><PageHeading category={`2026 · 车手档案 / ${driver.code}`} title={driver.name} description={`${driver.nameEn} · ${driver.team}`}/><AILink question={`请介绍 ${driver.name}（${driver.nameEn}）在 2026 赛季的表现、技术特点和已确认的成绩。`} className="btn-primary">向 APEX AI 了解这位车手 ↗</AILink></div><span className="profile-number mono" aria-label={`车号 ${driver.number}`}>{driver.number||'—'}</span></div><dl className="profile-stats"><div><dt>积分榜排名</dt><dd>P{driver.rank}</dd></div><div><dt>赛季总积分</dt><dd>{driver.points}</dd></div><div><dt>分站冠军</dt><dd>{driver.wins}</dd></div><div><dt>距榜首积分</dt><dd>{driver.gap===0?'领跑':driver.gap}</dd></div></dl><div className="profile-links"><Link href={`/teams/${driver.teamId}`} className="text-link">查看所属车队 ↗</Link><Link href="/standings" className="text-link">查看锦标赛积分 ↗</Link></div></div></div>;
}
