'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {AILink} from './ai-link';
import type {F1Meeting,DetailedRaceResultItem,DetailedQualifyingResultItem,DetailedSprintResultItem} from '@/lib/f1/types';
import {RaceStateService} from '@/lib/f1/race-state';
import {formatBeijingDisplay} from '@/lib/f1/time';
import {sessionEvidence} from '@/lib/profile/paddock';
import styles from './race-cockpit.module.css';

export function RaceCockpit({meeting,race,qualifying,sprint}:{meeting:F1Meeting;race:DetailedRaceResultItem[];qualifying:DetailedQualifyingResultItem[];sprint:DetailedSprintResultItem[]}){
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{const tick=()=>{if(!document.hidden)setNow(Date.now());};tick();const timer=setInterval(tick,1000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[]);
 const state=RaceStateService.evaluateMeeting(meeting,now??0),next=state.nextSession;
 const remaining=next&&now!==null?Math.max(0,Date.parse(next.startTimeUTC)-now):0;
 const seconds=Math.floor(remaining/1000),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);
 if (!meeting.round) return <section className="editorial-section paper-section" id="race-cockpit"><div className="container"><h2>比赛周驾驶舱</h2><p role="status">分站赛程暂不可用，时间与成绩待同步。</p><Link className="text-link" href={`/races?season=${meeting.season}`}>查看赛历 ↗</Link></div></section>;
 return <section className="editorial-section paper-section" id="race-cockpit"><div className="container">
  <div className="section-head"><div><span className="eyebrow">第 {meeting.round} 站 · {meeting.season}</span><h2>比赛周驾驶舱</h2><p>{meeting.nameZh||meeting.name} · {meeting.circuitName}</p></div><Link className="text-link" href={`/races/${meeting.round}?season=${meeting.season}`}>分站详情与赛果 ↗</Link></div>
  <div className={styles.workspace}>
   <div className={styles.focus}>
    <span className={styles.kicker}>下一节 · 北京时间</span>
    <h3>{now===null?'正在校准赛程…':next?.name||'本分站暂无后续场次'}</h3>
    {next&&<time dateTime={next.startTimeUTC}>{formatBeijingDisplay(next.startTimeUTC)}</time>}
    {now===null?<p role="status">正在校准北京时间…</p>:next?<div className={styles.countdown} aria-label={`距计划开赛 ${days} 天 ${hours} 小时 ${minutes} 分 ${seconds%60} 秒`}>{[[days,'天'],[hours,'时'],[minutes,'分'],[seconds%60,'秒']].map(([value,label])=><span key={label}><strong>{String(value).padStart(2,'0')}</strong><small>{label}</small></span>)}</div>:<p className={styles.muted}>查看分站详情，获取已收录成绩。</p>}
    <p className={styles.disclaimer}>按赛程倒计时，实际开始与状态以官方公布为准。</p>
    <Link className={styles.primary} prefetch={false} href={`/live?season=${meeting.season}&round=${meeting.round}`}>打开赛事中心 <span aria-hidden="true">↗</span></Link>
   </div>
   <div className={styles.schedule}>
    <header className={styles.scheduleHead}><h3>周末时间表</h3><span>北京时间</span></header>
    {meeting.sessions.length?<ol className={styles.sessions}>{meeting.sessions.map(session=>{
     const results=session.type==='race'?race:session.type==='qualifying'?qualifying:session.type==='sprint'?sprint:[];
     const isNext=next?.id===session.id;
     return <li key={session.id} className={`${styles.session} ${isNext?styles.next:''}`}>
      <div className={styles.sessionMain}><div><h4>{session.name}</h4><span className={styles.status}>{isNext?'下一节 · ':''}{now===null?'状态校准中':sessionEvidence(session,results.length,now)}</span></div><time dateTime={session.startTimeUTC}>{formatBeijingDisplay(session.startTimeUTC)}</time></div>
      {(results.length>0||session.officialSourceUrl)&&<details className={styles.sessionDetails}><summary>{results.length?'成绩与来源':'官方来源'}</summary>{results.length>0&&<ol className={styles.results}>{results.slice(0,3).map(row=><li key={row.driverId} value={row.position}>{row.driverName}{'points' in row?` · ${row.points} 分`:''}</li>)}</ol>}{session.officialSourceUrl&&<a href={session.officialSourceUrl} target="_blank" rel="noopener noreferrer">官方场次来源 ↗</a>}</details>}
     </li>;
    })}</ol>:<p className={styles.muted}>分站场次时间待公布。</p>}
   </div>
  </div>
  <div className={styles.footer}><details className={styles.note}><summary>赛程与成绩说明</summary><p>倒计时依据赛程，不代表实际开赛；实际开始、结束及成绩以官方公布为准。</p><p>成绩来自已收录数据，可能为缓存快照；未收录成绩不代表比赛尚未结束。</p></details><nav className={styles.links} aria-label="比赛周快捷入口"><Link href={`/races?season=${meeting.season}`}>赛历与订阅 ↗</Link><AILink question={`请分析 ${meeting.season} 赛季第 ${meeting.round} 站 ${meeting.nameZh||meeting.name} 的赛程、赛道特点与比赛看点，并区分已确认事实和预测。`}>AI 赛事分析 ↗</AILink></nav></div>
 </div></section>;
}
