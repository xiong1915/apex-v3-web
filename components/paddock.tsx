'use client';

import {useEffect,useRef,useState, type CSSProperties} from 'react';
import Link from 'next/link';
import {fetchAccountProfile, type UserProfile} from '@/lib/profile/client';
import type {ConstructorStanding, DriverStanding, DetailedRaceResultItem} from '@/lib/f1/types';
import {selectFavoriteTeams} from '@/lib/profile/paddock';
import {F1_TEAMS_2026} from '@/lib/f1/teams-metadata';
import styles from './paddock.module.css';
import { PersistentDetails } from '@/components/persistent-details';

function scopeLabel(row?: ConstructorStanding | DriverStanding) {
 return row?.officialRound?`截止第 ${row.officialRound} 站${row.snapshotSession==='sprint'?'冲刺赛':row.snapshotSession==='race'?'正赛':' · 场次待核实'}`:'截止范围待核实';
}

export function Paddock({teams,drivers,recent,recentRound,note}:{teams:ConstructorStanding[];drivers:DriverStanding[];recent:DetailedRaceResultItem[];recentRound?:number;note:string}) {
 const [state,setState]=useState<{loading:boolean;profile:UserProfile|null;error?:string}>({loading:true,profile:null});
 const revision=useRef(0);
 const load=async()=>{const current=++revision.current;setState({loading:true,profile:null});const result=await fetchAccountProfile();if(current===revision.current)setState({loading:false,profile:result.profile,error:result.error});};
 useEffect(()=>{load();const changed=()=>{load();};const updated=(event:Event)=>{const profile=(event as CustomEvent<UserProfile>).detail;setState(previous=>previous.profile?.id===profile?.id?{loading:false,profile}:previous);};window.addEventListener('apex:identity-changed',changed);window.addEventListener('apex:profile-updated',updated);return()=>{revision.current++;window.removeEventListener('apex:identity-changed',changed);window.removeEventListener('apex:profile-updated',updated);};},[]);
 const favorites=selectFavoriteTeams(state.profile?.favorite_team_ids||[],teams,drivers,recent);
 return <section className="editorial-section" id="paddock"><div className="container">
  <div className="section-head"><div><span className="eyebrow">APEX ID · 我的关注</span><h2>我的围场</h2><p>关注车队的赛季积分与最近正赛表现。</p></div><Link className="text-link" href="/profile">管理关注 ↗</Link></div>
  {state.loading?<p role="status">正在读取你的围场…</p>:state.error?<div role="alert"><p>{state.error}</p><button className="btn-secondary" onClick={load}>重新加载</button></div>:!state.profile?<div className={styles.notice}><p>登录并收藏车队，让你的围场从这里开始。</p><Link className="btn-secondary" href="/login?returnUrl=/">登录 APEX ID ↗</Link></div>:!favorites.length?<div className={styles.notice}><p>{state.profile.display_name}，你还没有收藏车队。</p><Link className="btn-secondary" href="/profile">选择关注车队 ↗</Link></div>:<>
   <div className={styles.grid}>{favorites.map(({id,standing,drivers:lineup,recent:results})=>{
    const metadata=F1_TEAMS_2026.find(team=>team.id===id);
    const roster=[...lineup.map(driver=>({id:driver.driverId,name:driver.name,standing:driver,result:results.find(row=>row.driverId===driver.driverId)})),...results.filter(row=>!lineup.some(driver=>driver.driverId===row.driverId)).map(row=>({id:row.driverId,name:row.driverName,standing:null,result:row}))];
    return <article className={styles.card} key={id} style={{'--team-color':metadata?.primaryColor||'var(--accent)'} as CSSProperties}>
     <header className={styles.teamHead}><Link href={`/teams/${id}`}><span className={styles.teamMark} aria-hidden="true"/><h3>{metadata?.name||standing?.name||id}</h3><span className={styles.arrow} aria-hidden="true">↗</span></Link><span className={styles.teamCode}>{metadata?.code||'车队'}</span></header>
     {standing?<div className={styles.score}><div><span className={styles.label}>车队排名</span><strong>P{standing.rank}</strong></div><div><span className={styles.label}>赛季积分</span><strong>{standing.points}<small> 分</small></strong></div></div>:<p className={styles.empty}>车队积分暂不可用</p>}
     <table className={styles.driverTable}><caption>{recentRound?`最近收录正赛 · 第 ${recentRound} 站`:'最近正赛暂不可用'}</caption><thead><tr><th scope="col">车手</th><th scope="col">赛季积分</th><th scope="col">最近正赛</th></tr></thead><tbody>{roster.length?roster.map(driver=><tr key={driver.id}><th scope="row"><Link href={`/drivers/${driver.id}`}>{driver.name}</Link>{driver.standing&&<span className={styles.sub}>赛季 P{driver.standing.rank}</span>}</th><td>{driver.standing?<>{driver.standing.points}<span className={styles.unit}> 分</span></>:'暂不可用'}</td><td>{driver.result?<><strong>P{driver.result.position}</strong><span className={styles.sub}>+{driver.result.points} 分</span></>:'暂不可用'}</td></tr>):<tr><td colSpan={3} className={styles.empty}>车手数据暂不可用</td></tr>}</tbody></table>
     <PersistentDetails id={`paddock-team-${id}`} className={styles.teamDetails}><summary>统计范围与完赛状态</summary><p>车队：{scopeLabel(standing)}</p>{lineup.map(driver=><p key={driver.driverId}>{driver.name}：{scopeLabel(driver)}</p>)}{results.map(row=><p key={row.driverId}>{row.driverName} · {row.status==='Finished'?'完赛':row.status||'状态暂不可用'}</p>)}</PersistentDetails>
    </article>;
   })}</div>
   <PersistentDetails id="paddock-source" className={styles.source}><summary>数据说明 <span>缓存与统计范围</span></summary><p>{note}</p><p>车手与车队积分可能来自不同截止场次，未核实的场次不作为已确认数据。</p><Link href="/standings">查看积分榜统计范围与来源 ↗</Link></PersistentDetails>
  </>}
 </div></section>;
}
