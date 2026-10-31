'use client';
import {useState,useEffect} from 'react';
import Link from 'next/link';
import {CircuitTrace} from '@/components/circuit-trace';
import {RankingList} from '@/components/ranking-list';
import {teamStyle} from '@/lib/ui/team-colors';
import {formatBeijingDisplay} from '@/lib/f1/time';
import type {DetailedRaceResultItem,DetailedQualifyingResultItem,DetailedSprintResultItem,F1Session} from '@/lib/f1/types';

export interface RaceDetailTabsProps {
 raceResults:DetailedRaceResultItem[];qualiResults:DetailedQualifyingResultItem[];sprintResults:DetailedSprintResultItem[];
 sessions:F1Session[];circuitId:string;season:string;meetingName:string;round:number;isHistorical:boolean;
}
type TabKey='race'|'sprint'|'qualifying'|'schedule';
function Classification({rows,title,qualifying=false}:{rows:(DetailedRaceResultItem|DetailedSprintResultItem|DetailedQualifyingResultItem)[];title:string;qualifying?:boolean}){
 return <RankingList count={rows.length}><div className="result-panel" tabIndex={0} role="region" aria-label={`${title}，可横向滚动`}><table className="data-table classification-table">
  <caption className="sr-only">{title}</caption><thead><tr><th scope="col">名次</th><th scope="col">车手</th><th scope="col">车队</th>{qualifying?<><th scope="col">Q1</th><th scope="col">Q2</th><th scope="col">Q3</th></>:<><th scope="col">发车位</th><th scope="col">圈数</th><th scope="col">完赛成绩 / 状态</th><th scope="col">积分</th></>}</tr></thead>
  <tbody>{rows.map((row,index)=><tr key={row.driverId||index} style={teamStyle(`${row.constructorId} ${row.constructorName}`)}>
   <td className="rank-cell mono">{row.position||'NC'}</td><th scope="row"><strong>{row.driverName}</strong><small>{row.driverCode}{row.driverNumber?` · #${row.driverNumber}`:''}</small>{'fastestLap' in row&&row.fastestLap?.rank==='1'&&<small className="classification-fastest">最快圈 {row.fastestLap.time}</small>}</th><td>{row.constructorName}</td>
   {qualifying?<>{(['q1','q2','q3'] as const).map(key=><td className="mono" key={key}>{(row as DetailedQualifyingResultItem)[key]||'—'}</td>)}</>:<><td className="mono">P{(row as DetailedRaceResultItem).grid}</td><td className="mono">{(row as DetailedRaceResultItem).laps}</td><td className="mono">{(row as DetailedRaceResultItem).time||(row as DetailedRaceResultItem).status}</td><td className="points-cell mono">{(row as DetailedRaceResultItem).points}</td></>}
  </tr>)}</tbody>
 </table></div></RankingList>;
}
export function RaceDetailTabs({raceResults,qualiResults,sprintResults,sessions,circuitId,season,meetingName,round,isHistorical}:RaceDetailTabsProps){
 const hasRaceResults=raceResults.length>0,hasSprintResults=sprintResults.length>0,hasQualiResults=qualiResults.length>0;
 const hasSchedule=!isHistorical&&sessions.length>0;
 const defaultTab:TabKey=hasRaceResults?'race':hasSprintResults?'sprint':hasQualiResults?'qualifying':hasSchedule?'schedule':'qualifying';
 const [activeTab,setActiveTab]=useState<TabKey>(defaultTab);
 useEffect(()=>{try{
  const saved=sessionStorage.getItem(`apex:race:${round}:${season}:tab`) as TabKey|null;
  if(saved&&((saved==='race'&&hasRaceResults)||(saved==='sprint'&&hasSprintResults)||saved==='qualifying'||(saved==='schedule'&&hasSchedule)))setActiveTab(saved);
 }catch{}},[round,season,hasRaceResults,hasSprintResults,hasSchedule]);
 const switchTab=(tab:TabKey)=>{setActiveTab(tab);try{sessionStorage.setItem(`apex:race:${round}:${season}:tab`,tab);}catch{}};
 const tabs:{key:TabKey;label:string}[]=[...(hasRaceResults?[{key:'race' as const,label:`正赛成绩 (${raceResults.length})`}]:[]),...(hasSprintResults?[{key:'sprint' as const,label:`冲刺赛成绩 (${sprintResults.length})`}]:[]),{key:'qualifying',label:`排位成绩 ${hasQualiResults?`(${qualiResults.length})`:''}`},...(hasSchedule?[{key:'schedule' as const,label:`周末赛程 (${sessions.length})`}]:[])];
 const qualiSession=sessions.find(session=>session.type==='qualifying');
 return <>
  <nav className="section-jumps" role="tablist" aria-label="分站内容">{tabs.map(tab=><button type="button" role="tab" key={tab.key} aria-selected={activeTab===tab.key} className={activeTab===tab.key?'active':''} onClick={()=>switchTab(tab.key)}>{tab.label}</button>)}</nav>
  {activeTab==='race'&&hasRaceResults&&<section className="race-data-section"><div className="section-head"><h2>正赛成绩</h2><span className="data-note">共 {raceResults.length} 位完赛/退赛车手</span></div><Classification key={`${season}:${round}:race`} rows={raceResults} title="正赛成绩"/></section>}
  {activeTab==='sprint'&&hasSprintResults&&<section className="race-data-section"><div className="section-head"><h2>冲刺赛成绩</h2><span className="data-note">共 {sprintResults.length} 位车手</span></div><Classification key={`${season}:${round}:sprint`} rows={sprintResults} title="冲刺赛成绩"/></section>}
  {activeTab==='qualifying'&&<section className="race-data-section"><div className="section-head"><h2>排位赛成绩</h2><span className="data-note">{hasQualiResults?`杆位：${qualiResults[0]?.driverName} (${qualiResults[0]?.q3||qualiResults[0]?.q2||qualiResults[0]?.q1||''})`:'历史档案记录'}</span></div>
   {hasQualiResults?<Classification key={`${season}:${round}:qualifying`} rows={qualiResults} qualifying title="排位赛成绩"/>:<div className="race-empty-note race-preview"><div className="race-preview-map" aria-hidden="true"><CircuitTrace circuitId={circuitId} season={season} meetingName={meetingName}/></div><div><span className="eyebrow">{isHistorical?'赛事档案':'节次预告'}</span><h3>{isHistorical?'详细排位成绩尚未收录':'等待排位成绩'}</h3><p>{isHistorical?'当前档案暂未提供详细圈速，不推测缺失成绩。':'成绩以实际发布为准，计划时间不代表赛事已结束。'}</p>{qualiSession&&<time dateTime={qualiSession.startTimeUTC}>北京时间 · {formatBeijingDisplay(qualiSession.startTimeUTC)}</time>}<Link className="text-link" href={`/live?season=${season}&round=${round}`}>查看节次状态 ↗</Link></div></div>}
  </section>}
  {activeTab==='schedule'&&hasSchedule&&<section className="race-data-section"><h2>周末时间表 · 北京时间</h2><div className="detail-schedule">{sessions.map((session,index)=><div key={session.id||index} className="detail-session"><div><div style={{fontSize:17,fontWeight:700,marginTop:2}}>{session.name}</div></div><div style={{textAlign:'right'}}><div className="tabular-nums" style={{fontFamily:'var(--font-mono)',fontSize:16,fontWeight:700}}>{formatBeijingDisplay(session.startTimeUTC)}</div><div style={{fontSize:12,color:'var(--text-secondary)',marginTop:2}}>预计 {session.durationMinutes} 分钟</div></div></div>)}</div></section>}
 </>;
}
