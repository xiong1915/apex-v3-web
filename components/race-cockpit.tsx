'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {F1Meeting,DetailedRaceResultItem,DetailedQualifyingResultItem,DetailedSprintResultItem} from '@/lib/f1/types';
import {RaceStateService} from '@/lib/f1/race-state';
import {formatBeijingDisplay} from '@/lib/f1/time';
import {sessionEvidence} from '@/lib/profile/paddock';
import styles from './paddock.module.css';

export function RaceCockpit({meeting,race,qualifying,sprint}:{meeting:F1Meeting;race:DetailedRaceResultItem[];qualifying:DetailedQualifyingResultItem[];sprint:DetailedSprintResultItem[]}){
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{const tick=()=>{if(!document.hidden)setNow(Date.now());};tick();const timer=setInterval(tick,1000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[]);
 const state=RaceStateService.evaluateMeeting(meeting,now??0),next=state.nextSession;
 const remaining=next&&now!==null?Math.max(0,Date.parse(next.startTimeUTC)-now):0;
 const seconds=Math.floor(remaining/1000),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);
 if (!meeting.round) return <section className="editorial-section paper-section" id="race-cockpit"><div className="container"><h2>比赛周驾驶舱</h2><p role="status">分站赛程暂不可用，时间与成绩待同步。</p><Link className="text-link" href={`/races?season=${meeting.season}`}>查看赛历 ↗</Link></div></section>;
 return <section className="editorial-section paper-section" id="race-cockpit"><div className="container"><div className="section-head"><div><span className="eyebrow">第 {meeting.round} 站 · {meeting.season}</span><h2>比赛周驾驶舱</h2><p>{meeting.nameZh||meeting.name} · {meeting.circuitName}</p></div><Link className="text-link" href={`/races/${meeting.round}?season=${meeting.season}`}>分站完整资料 ↗</Link></div>
 <p className={styles.countdown}>{now===null?'正在校准北京时间…':next?<>下一场：{next.name} · {days} 天 {hours} 时 {minutes} 分 {seconds%60} 秒</>:'本分站暂无后续场次'}</p><p className="data-note">倒计时依据赛程；比赛实际开始、结束及成绩以官方公布为准。</p>
 <div className={styles.sessions}>{meeting.sessions.map(session=>{const results=session.type==='race'?race:session.type==='qualifying'?qualifying:session.type==='sprint'?sprint:[];return <article key={session.id} className={`${styles.session} ${next?.id===session.id?styles.next:''}`}><h3>{session.name}</h3><time dateTime={session.startTimeUTC}>{formatBeijingDisplay(session.startTimeUTC)}</time><p className="data-note">{now===null?'状态校准中':sessionEvidence(session,results.length,now)}</p>{results.length>0&&<ol className={styles.results}>{results.slice(0,3).map(row=><li key={row.driverId} value={row.position}>{row.driverName}{'points' in row?` · ${row.points} 分`:''}</li>)}</ol>}{session.officialSourceUrl&&<a className="text-link" href={session.officialSourceUrl} target="_blank" rel="noopener noreferrer">官方场次来源 ↗</a>}</article>;})}</div>
 {!meeting.sessions.length&&<p>分站场次时间待公布。</p>}<p className="data-note">成绩来自 Canonical F1 数据层的已收录成绩，可能为缓存快照；未收录成绩不代表比赛尚未结束。</p><div className={styles.links}><Link className="text-link" href={`/races/${meeting.round}?season=${meeting.season}`}>完整赛果与来源 ↗</Link><Link className="text-link" href={`/races?season=${meeting.season}`}>赛历与订阅 ↗</Link><Link className="text-link" prefetch={false} href={`/replay?season=${meeting.season}&round=${meeting.round}`}>回放工作台 ↗</Link><Link className="text-link" href="/ai">赛事分析 ↗</Link></div></div></section>;
}
