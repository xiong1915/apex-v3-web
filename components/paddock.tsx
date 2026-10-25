'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {fetchAccountProfile, type UserProfile} from '@/lib/profile/client';
import type {ConstructorStanding, DriverStanding, DetailedRaceResultItem} from '@/lib/f1/types';
import {selectFavoriteTeams} from '@/lib/profile/paddock';
import {F1_TEAMS_2026} from '@/lib/f1/teams-metadata';
import styles from './paddock.module.css';

export function Paddock({teams,drivers,recent,recentRound,note}:{teams:ConstructorStanding[];drivers:DriverStanding[];recent:DetailedRaceResultItem[];recentRound?:number;note:string}) {
 const [state,setState]=useState<{loading:boolean;profile:UserProfile|null;error?:string}>({loading:true,profile:null});
 const revision=useRef(0);
 const load=async()=>{const current=++revision.current;setState({loading:true,profile:null});const result=await fetchAccountProfile();if(current===revision.current)setState({loading:false,profile:result.profile,error:result.error});};
 useEffect(()=>{load();const changed=()=>{load();};const updated=(event:Event)=>{const profile=(event as CustomEvent<UserProfile>).detail;setState(previous=>previous.profile?.id===profile?.id?{loading:false,profile}:previous);};window.addEventListener('apex:identity-changed',changed);window.addEventListener('apex:profile-updated',updated);return()=>{revision.current++;window.removeEventListener('apex:identity-changed',changed);window.removeEventListener('apex:profile-updated',updated);};},[]);
 const favorites=selectFavoriteTeams(state.profile?.favorite_team_ids||[],teams,drivers,recent);
 return <section className="editorial-section" id="paddock"><div className="container"><div className="section-head"><div><span className="eyebrow">APEX ID · 为你关注</span><h2>我的围场</h2><p>收藏车队的积分、车手与最近一站表现。</p></div><Link className="text-link" href="/profile">管理关注 ↗</Link></div>
 {state.loading?<p role="status">正在读取你的围场…</p>:state.error?<div role="alert"><p>{state.error}</p><button className="btn-secondary" onClick={load}>重新加载</button></div>:!state.profile?<div className={styles.notice}><p>登录并收藏车队，让你的围场从这里开始。</p><Link className="btn-secondary" href="/login?returnUrl=/">登录 APEX ID ↗</Link></div>:!favorites.length?<div className={styles.notice}><p>{state.profile.display_name}，你还没有收藏车队。</p><Link className="btn-secondary" href="/profile">选择关注车队 ↗</Link></div>:<><div className={styles.grid}>{favorites.map(({id,standing,drivers:lineup,recent:results})=><article className={styles.card} key={id}><Link href={`/teams/${id}`} className="text-link"><h3>{standing?.name||F1_TEAMS_2026.find(team=>team.id===id)?.name||id} ↗</h3></Link><p className={styles.score}>{standing?`P${standing.rank} · ${standing.points} 分`:'车队积分暂不可用'}</p><p className="data-note">{standing?.officialRound?`车队积分截止第 ${standing.officialRound} 站${standing.snapshotSession==='sprint'?'冲刺赛':standing.snapshotSession==='race'?'正赛':'（场次范围待核实）'}`:'车队积分截止范围待核实'}</p><div className={styles.divider}>{lineup.length?lineup.map(driver=><p key={driver.driverId}><Link href={`/drivers/${driver.driverId}`}>{driver.name} ↗</Link><span>P{driver.rank} · {driver.points} 分 · {driver.officialRound?`截止第 ${driver.officialRound} 站${driver.snapshotSession==='sprint'?'冲刺赛':driver.snapshotSession==='race'?'正赛':'（场次待核实）'}`:'截止范围待核实'}</span></p>):<p>车手积分暂不可用</p>}</div><p className="data-note">{recentRound?`最近收录正赛 · 第 ${recentRound} 站`:'最近正赛暂不可用'}</p>{results.length?results.map(row=><p key={row.driverId}>{row.driverName} · P{row.position} · {row.points} 分 · {row.status}</p>):<p>暂无该车队的本场成绩，不推算表现。</p>}</article>)}</div><p className="data-note">{note}</p><p className="data-note">车手与车队积分可能来自不同截止场次；<Link href="/standings">查看各自统计范围与来源 ↗</Link></p></>}
 </div></section>;
}
