import Link from 'next/link';
import { defaultF1Service } from '@/providers/f1/service';
import { PageHeading } from '@/components/page-heading';
export const dynamic='force-dynamic';
export default async function DriversPage(){
 const drivers=await defaultF1Service.getDriverStandings('2026');
 return <div className="page-shell page-drivers"><div className="container"><PageHeading category="2026 · 车手档案" title="赛道上的竞争者" description="按本赛季官方积分记录收录。出场记录不代表车手当前席位。" meta={<span>共 {drivers.length} 位车手记录</span>}/>
 {!drivers.length&&<div className="empty-state" role="status">车手数据暂不可用，请稍后重试。</div>}
 <div className="driver-grid">{drivers.map(d=><Link className="driver-tile" href={`/drivers/${d.driverId||d.code.toLowerCase()}`} key={d.driverId||d.code}><div className="driver-tile-top"><span className="rank-chip">P{d.rank}</span><span className="driver-race-number mono">{d.number||'—'}</span></div><h2>{d.name}</h2><p className="driver-en">{d.nameEn}</p><p className="driver-team">{d.team}</p><div className="driver-tile-bottom"><span><strong className="mono">{d.points}</strong><small>赛季积分</small></span><span className="tile-arrow" aria-hidden="true">↗</span></div></Link>)}</div>
 </div></div>;
}
