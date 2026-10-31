'use client';
import {memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import type {PublicLiveResponse,LiveResult} from '@/lib/f1/live/public-types';
import type {LiveDriver,LivePhase} from '@/lib/f1/live/types';
import {OFFICIAL_LIVE_TIMING_URL} from '@/lib/f1/live/links';
import {formatBeijingDisplay,formatTime} from '@/lib/f1/time';
import {connectionForDisplay,countdownParts,phaseForDisplay,retryDelay,sortLiveDrivers} from './model';
import styles from '@/app/live/live.module.css';
import { PersistentDetails } from '@/components/persistent-details';

const phaseLabels:Record<LivePhase,string>={UPCOMING:'即将开始',WAITING:'赛事状态待确认',LIVE:'比赛进行中',SUSPENDED:'赛事暂停',FINISHED:'节次结束',DELAYED:'赛事延迟',CANCELLED:'节次取消'};
const connectionLabels={LIVE:'LIVE · 数据新鲜',DELAYED:'DELAYED · 数据延迟',RECONNECTING:'RECONNECTING · 正在恢复',UNAVAILABLE:'UNAVAILABLE · 实时来源不可用',FINISHED:'FINISHED · 节次结束'};
const classifications={unavailable:'成绩待确认',provisional:'临时成绩',confirmed:'已确认成绩',official:'官方最终成绩'};
const unavailable='暂不可用';
const value=(item:unknown)=>item==null||item===''?unavailable:String(item);
function safeExternal(url:string){try{const parsed=new URL(url);return parsed.protocol==='https:'?parsed.href:null;}catch{return null;}}
function dataDate(date:string|null){return date&&Number.isFinite(Date.parse(date))?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(date)):'尚未收到数据';}

const DriverRow=memo(function DriverRow({driver,favorite,toggle}:{driver:LiveDriver;favorite:boolean;signature:string;toggle:(number:string)=>void}){
 const color=driver.teamColour&&/^#?[a-f\d]{6}$/i.test(driver.teamColour)?`#${driver.teamColour.replace('#','')}`:'#8c929b';
 return <tr className={favorite?styles.followed:''}><td className={styles.rank}>{value(driver.position)}</td><th scope="row" className={styles.stickyDriver}><div className={styles.driver}><span style={{background:color}} className={styles.teamLine}/><div><strong>{driver.code||driver.name||`#${driver.number}`}</strong><small>#{driver.number} · {driver.name||unavailable}</small><small>{driver.team||unavailable}</small></div><button aria-label={`${favorite?'取消关注':'关注'} ${driver.code||driver.number}`} aria-pressed={favorite} onClick={()=>toggle(driver.number)} className={styles.star}>{favorite?'★':'☆'}</button></div></th><td>{value(driver.lastLap)}</td><td className={styles.best}>{value(driver.bestLap)}</td>{[0,1,2].map(index=><td key={index} className={driver.sectorOverallBest?.[index]?styles.purple:driver.sectorPersonalBest?.[index]?styles.green:''}>{value(driver.sectors[index])}{driver.sectorOverallBest?.[index]?<small>全场最快</small>:driver.sectorPersonalBest?.[index]?<small>个人最快</small>:null}</td>)}<td>{value(driver.gapLeader)}</td><td>{value(driver.gapAhead)}</td><td>{value(driver.completedLaps)}</td><td>{value(driver.compound)}<small>胎龄 {value(driver.tyreAge)}</small></td><td>{value(driver.pitCount)}<small>{driver.retired===true?'退赛':driver.inPit===true?'维修区':driver.inPit===false?'赛道上':unavailable}</small></td><td className={styles.timeCell}>{driver.updatedAt?formatTime(driver.updatedAt):unavailable}</td></tr>;
},(before,after)=>before.signature===after.signature&&before.favorite===after.favorite&&before.toggle===after.toggle);

function ResultTable({results,type}:{results:LiveResult[];type:string}){const qualifying=type==='qualifying'||type==='sprint_qualifying',prefix=type==='sprint_qualifying'?'SQ':'Q';return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="已确认成绩，可横向滚动"><table className={styles.resultTable}><caption className="sr-only">当前节次已收录的真实成绩</caption><thead><tr><th scope="col">名次</th><th scope="col">车手</th><th scope="col">车队</th>{qualifying?<>{[1,2,3].map(index=><th scope="col" key={index}>{prefix}{index}</th>)}</>:<><th scope="col">时间 / 差距</th><th scope="col">圈数</th><th scope="col">积分</th></>}<th scope="col">状态</th></tr></thead><tbody>{results.map(row=><tr key={row.number||row.code||row.name}><td>{row.position}</td><th scope="row">{row.name}<small>{row.code} {row.number?`· #${row.number}`:''}</small></th><td>{row.team}</td>{qualifying?<><td>{value(row.q1)}</td><td>{value(row.q2)}</td><td>{value(row.q3)}</td></>:<><td>{value(row.time)}</td><td>{value(row.laps)}</td><td>{value(row.points)}</td></>}<td>{value(row.status)}</td></tr>)}</tbody></table></div>;}

export interface LiveTimingCenterProps {
 initialData?: PublicLiveResponse | null;
}

export function LiveTimingCenter({initialData}:LiveTimingCenterProps={}){
 const params=useSearchParams();
 const baseQuery=useMemo(()=>{const query=new URLSearchParams();for(const name of ['season','round','session']){const item=params.get(name);if(item)query.set(name,item);}return query.toString();},[params]);
 const [query,setQuery]=useState(baseQuery),[data,setData]=useState<PublicLiveResponse|null>(initialData||null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(!initialData),[now,setNow]=useState<number|null>(null),[filter,setFilter]=useState(''),[order,setOrder]=useState('position'),[favorites,setFavorites]=useState<string[]>([]),[onlyFavorites,setOnlyFavorites]=useState(false);
 const sessionListRef=useRef<HTMLDivElement>(null);
 const initialQuery=useRef(baseQuery);
 const offset=useRef(0),dataRef=useRef<PublicLiveResponse|null>(initialData||null),refreshRef=useRef<()=>void>(()=>{}),requestRevision=useRef(0);
 useEffect(()=>{setQuery(baseQuery);},[baseQuery]);
 useEffect(()=>{try{const stored=JSON.parse(localStorage.getItem('apex:live:favorites')||'[]');if(Array.isArray(stored))setFavorites(stored.filter(number=>typeof number==='string'&&/^\d{1,3}$/.test(number)).slice(0,30));}catch{}},[]);
 const toggle=useCallback((number:string)=>setFavorites(previous=>{const next=previous.includes(number)?previous.filter(item=>item!==number):[...previous,number].slice(-30);try{localStorage.setItem('apex:live:favorites',JSON.stringify(next));}catch{}return next;}),[]);
 useEffect(()=>{
  let disposed=false,timer:ReturnType<typeof setTimeout>|null=null,controller:AbortController|null=null,inFlight=false,refreshPending=false,attempt=0;
  const revision=++requestRevision.current;
  if(!initialData||query!==initialQuery.current){
   const wanted=new URLSearchParams(query),previous=dataRef.current;
   const sameMeeting=Boolean(previous&&wanted.get('session')&&previous.sessions.some(item=>item.session.id===wanted.get('session'))&&(!wanted.get('round')||Number(wanted.get('round'))===previous.meeting?.round)&&(!wanted.get('season')||wanted.get('season')===previous.season));
   if(!sameMeeting){dataRef.current=null;setData(null);}
   setError(null);setLoading(true);
  }
  function schedule(delay:number){if(timer)clearTimeout(timer);if(!disposed&&!document.hidden)timer=setTimeout(poll,delay);}
  async function poll(){
   if(disposed||document.hidden||inFlight)return;
   inFlight=true;controller=new AbortController();const current=controller,started=Date.now();const timeout=setTimeout(()=>current.abort(),12000);
   try{
    const response=await fetch(`/api/f1/live/snapshot${query?'?'+query:''}`,{cache:'no-store',signal:current.signal});
    const body=await response.json();
    if(!response.ok)throw new Error(body.error||'赛事数据暂不可用');
    if(body.version!=='3.3.0'||!body.availability||!Array.isArray(body.sessions)||!Array.isArray(body.results)||!Number.isFinite(Date.parse(body.serverTime)))throw new Error('赛事数据格式无效，请稍后重试');
    if(disposed||revision!==requestRevision.current||current.signal.aborted)return;
    offset.current=Date.parse(body.serverTime)+(Date.now()-started)/2-Date.now();dataRef.current=body;setData(body);setError(null);attempt=0;
   }catch(cause){if(!disposed&&revision===requestRevision.current&&!document.hidden){setError(cause instanceof Error?cause.message:'连接暂不可用');attempt++;}}
   finally{clearTimeout(timeout);if(controller===current)controller=null;inFlight=false;if(!disposed&&revision===requestRevision.current){setLoading(false);const immediate=refreshPending;refreshPending=false;schedule(immediate?0:attempt?retryDelay(attempt-1):dataRef.current?.availability.timingPublic?3000:60000);}}
  }
  const refresh=()=>{if(timer)clearTimeout(timer);if(inFlight)refreshPending=true;else void poll();};refreshRef.current=refresh;
  const visibility=()=>{if(document.hidden){if(timer)clearTimeout(timer);controller?.abort();}else{setNow(Date.now()+offset.current);refresh();}};
  const clock=setInterval(()=>{if(!document.hidden)setNow(Date.now()+offset.current);},1000);setNow(Date.now());
  document.addEventListener('visibilitychange',visibility);void poll();
  return()=>{disposed=true;if(timer)clearTimeout(timer);clearInterval(clock);controller?.abort();document.removeEventListener('visibilitychange',visibility);};
 },[query,initialData]);

 const session=data?.session;
 const requestedSession=new URLSearchParams(query).get('session');
 const isSessionSwitch=Boolean(data&&session&&requestedSession&&requestedSession!==session.id&&data.sessions.some(item=>item.session.id===requestedSession));
 const selectedSessionId=isSessionSwitch?requestedSession:session?.id;
 useEffect(()=>{
  const list=sessionListRef.current;if(!list)return;
  const update=()=>{const button=list.querySelector<HTMLElement>('button[aria-pressed="true"]');const lens=list.querySelector<HTMLElement>('[data-session-lens]');if(!button||!lens)return;lens.style.width=`${button.offsetWidth}px`;lens.style.height=`${button.offsetHeight}px`;lens.style.transform=`translate3d(${button.offsetLeft}px,${button.offsetTop}px,0)`;lens.style.opacity='1';};
  update();const observer=new ResizeObserver(update);observer.observe(list);return()=>observer.disconnect();
 },[selectedSessionId,data?.sessions.length]);
 const rawSnapshot=data?.availability.timingPublic?data.snapshot:null;
 const hasCurrentResults=Boolean(data?.results&&data.results.length>0);
 const isCurrentReplay=!rawSnapshot&&hasCurrentResults;
 const isRecapMode=!rawSnapshot&&!hasCurrentResults&&Boolean(data?.recapResults&&data.recapResults.length>0);
 const isReplayMode=isCurrentReplay||isRecapMode;
 const recapTitle=data?.latestFinishedMeeting?`第 ${data.latestFinishedMeeting.round} 站 ${data.latestFinishedMeeting.nameZh||data.latestFinishedMeeting.name}`:'最近完赛分站';
 const sourceAge=rawSnapshot?.sourceTimestamp&&now!==null?now-Date.parse(rawSnapshot.sourceTimestamp):null;
 const selected=data?.sessions.find(item=>item.session.id===session?.id);
 const phase=phaseForDisplay(rawSnapshot?.phase||selected?.phase||'UPCOMING',session?.startTimeUTC||'',now??0);
 const connection=rawSnapshot?(isSessionSwitch?'RECONNECTING':connectionForDisplay(rawSnapshot.connection,rawSnapshot.sourceTimestamp,now??Date.now(),!!error)):isReplayMode?'FINISHED':'UNAVAILABLE';
 const parts=session&&now!==null?countdownParts(session.startTimeUTC,now):null;

 const driversList=rawSnapshot?.drivers||[];

 const rows=useMemo(()=>sortLiveDrivers(driversList,order).filter(driver=>(!onlyFavorites||favorites.includes(driver.number))&&(!filter||`${driver.number} ${driver.code} ${driver.name} ${driver.team}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))),[driversList,order,filter,onlyFavorites,favorites]);

 const pickSession=(id:string,nextMeeting=false)=>{const next=new URLSearchParams(query);const meeting=nextMeeting?data?.nextMeeting:data?.meeting;if(data?.season)next.set('season',meeting?.season||data.season);if(meeting)next.set('round',String(meeting.round));next.set('session',id);history.replaceState(null,'',`/live?${next}`);setQuery(next.toString());};
 const pickMeeting=(roundNumber:number)=>{const next=new URLSearchParams(query);if(data?.season)next.set('season',data.season);next.set('round',String(roundNumber));next.delete('session');history.replaceState(null,'',`/live?${next}`);setQuery(next.toString());};

 const official=safeExternal(data?.availability.officialUrl||OFFICIAL_LIVE_TIMING_URL);
 const nextSession=data?.nextSession;
 const nextParts=nextSession&&now!==null?countdownParts(nextSession.startTimeUTC,now):null;
 const nextIsOtherMeeting=!!(data?.nextMeeting&&nextSession&&!data.meeting?.sessions.some(item=>item.id===nextSession.id&&item.startTimeUTC===nextSession.startTimeUTC));

 const messages=rawSnapshot?.messages||[];
 const airTemp=rawSnapshot?.weather?.airTemperature??null;
 const trackTemp=rawSnapshot?.weather?.trackTemperature??null;
 const rainfall=rawSnapshot?.weather?.rainfall??null;

 return <div className={styles.shell}><div className="container">
  <header className={styles.heading}><div><span className="eyebrow">tikeai · 赛事数据中心</span><h1>tikeai <span>LIVE TIMING</span></h1><p>赛程、节次状态与已收录成绩，一处查看。</p></div><Link className="text-link" href="/races">全季赛历与订阅 ↗</Link></header>
  {isSessionSwitch?<p className={styles.switchNotice} role="status">{error?'切换失败，正在重试；当前仍显示上一节数据。':'正在切换节次；当前仍显示上一节数据。'}</p>:null}
  {params.has('legacySession')?<p className={styles.source} role="note">旧回放已升级，请选择分站和节次；历史回放编号不代表当前直播。</p>:null}
  
  {data?.availableMeetings&&data.availableMeetings.length>0?<div className={styles.roundSelectorBar}><label htmlFor="round-select">大奖赛</label><select id="round-select" value={data.meeting?.round||''} onChange={e=>pickMeeting(Number(e.target.value))}>{data.availableMeetings.map(m=><option key={m.round} value={m.round}>第 {m.round} 站 · {m.nameZh||m.name} {m.status==='finished'?'(已完赛)':m.status==='next'?'(即将开赛)':''}</option>)}</select></div>:null}

  {loading&&!data?<div className={styles.loading} role="status">正在读取赛程与可信赛事状态…</div>:null}
  {error?<div className={styles.error} role="alert"><div><strong>{data?'连接中断，正在恢复':'赛事数据暂不可用'}</strong><p>{error}{data?'。已保留最后一份数据，请留意更新时间。':''}</p>{!data&&official?<a href={official} target="_blank" rel="noopener noreferrer">F1 官方实时计时 ↗</a>:null}</div><button type="button" onClick={()=>refreshRef.current()}>重新连接</button></div>:null}
  {data?<>
  <section className={styles.hero} aria-labelledby="meeting-title"><div className={styles.heroCopy}><div className={styles.heroStatus}><span className={styles.phase} data-phase={phase}>{phase==='LIVE'&&connection!=='LIVE'?'最后已知：比赛进行中':phaseLabels[phase]}</span><span className={styles.season}>{data.season} · {data.meeting?`第 ${data.meeting.round} 站`:'等待赛程'}</span></div><h2 id="meeting-title">{data.meeting?.nameZh||data.meeting?.name||'本赛季赛事'}</h2><p>{data.meeting?.circuitName||'赛道待公布'}{data.meeting?` · ${data.meeting.locality} / ${data.meeting.country}`:''}</p><div className={styles.sessionTitle}><strong>{session?.name||'等待官方节次安排'}</strong>{rawSnapshot?.segment?<span className={styles.segment}>{rawSnapshot.segment}</span>:isReplayMode?<span className={styles.replayBadge}>{isRecapMode?`${recapTitle} · 已收录成绩`:'已收录成绩'}</span>:null}</div><p className={styles.startTime}>{session?formatBeijingDisplay(session.startTimeUTC):'开赛时间待公布'} <span>北京时间 UTC+8</span></p>
  {(phase==='UPCOMING'||phase==='WAITING'||phase==='DELAYED')&&parts?<div className={styles.countdown} aria-label="距离赛程开赛时间">{parts.map((part,index)=><div key={index}><strong>{String(part).padStart(2,'0')}</strong><span>{['天','小时','分钟','秒'][index]}</span></div>)}</div>:null}
  
  {(phase==='UPCOMING'||phase==='WAITING')&&!data.results.length&&data.latestFinishedMeeting&&data.meeting?.round!==data.latestFinishedMeeting?.round?<div className={styles.recapBanner} role="region" aria-label="已完赛分站直通推荐"><div className={styles.recapInfo}><span className={styles.recapTag}>围场休整中</span><p>当前尚未开赛，下方可查看<strong>{recapTitle}</strong>的已收录成绩。</p></div><button type="button" className={styles.recapBtn} onClick={()=>pickMeeting(data.latestFinishedMeeting!.round)}>查看该分站 ↗</button></div>:null}

  {phase==='WAITING'?<p className={styles.statusNote}>计划时间已到，实际节次状态待确认；不能仅凭赛程判断开赛或完赛。</p>:phase==='SUSPENDED'?<p className={styles.statusNote}>{rawSnapshot?.reason||'节次暂停，当前计时表已保留，等待恢复。'}</p>:phase==='CANCELLED'||phase==='DELAYED'?<p className={styles.statusNote}>{rawSnapshot?.reason||selected?.reason||'请关注赛会时间调整。'}</p>:phase==='FINISHED'?<p className={styles.statusNote}>{selected?.reason||`${classifications[data.resultStatus]} · ${rawSnapshot?.reason||'查看本节次已收录的真实成绩。'}`}</p>:<p className={styles.statusNote}>赛程时间不代表实际开赛；延期、暂停与完赛以可信赛事信息为准。</p>}
  <div className={styles.heroLinks}>{official?<a href={official} target="_blank" rel="noopener noreferrer" className={styles.official}>F1 官方实时计时 ↗</a>:null}{data.meeting?<Link href={`/races/${data.meeting.round}?season=${data.season}`}>分站资料 ↗</Link>:null}</div></div><aside className={styles.weekend}><div className={styles.weekendTitle}><h3>本周末节次</h3><span>{data.meeting?.isSprintWeekend?'冲刺周末':'大奖赛周末'}</span></div><div ref={sessionListRef} className={styles.sessionList}><span className={styles.sessionLens} data-session-lens aria-hidden="true"/>{data.sessions.map(item=><button key={item.session.id} type="button" onClick={()=>pickSession(item.session.id)} aria-pressed={item.session.id===selectedSessionId} className={item.session.id===selectedSessionId?styles.selectedSession:''}><span><strong>{item.session.name}</strong><small>{formatBeijingDisplay(item.session.startTimeUTC)}</small></span><span className={styles.sessionState}>{phaseLabels[phaseForDisplay(item.phase,item.session.startTimeUTC,now??0)]}</span></button>)}</div>{!data.sessions.length?<p>当前没有可显示的节次安排。</p>:null}</aside></section>
  
  {!data.availability.timingPublic?<section className={styles.permission}><div className={styles.permissionIcon} aria-hidden="true">i</div><div><h2>完整实时圈速尚不可公开提供</h2><p>{data.availability.reason}</p><p>这里提供真实赛程、倒计时与已确认成绩。查看比赛期间完整计时，请使用 F1 官方入口。</p></div></section>:null}
  
  {!rawSnapshot||data.results.length>0?<section className={styles.results}><div className={styles.sectionHead}><div><span className="eyebrow">{isRecapMode?'完赛分站 · 真实成绩归档':'当前节次 · 真实成绩'}</span><h2>{isRecapMode?`${recapTitle} · 正赛成绩`:classifications[data.resultStatus]}</h2></div>{isRecapMode?<span>正赛</span>:session?<span>{session.name}</span>:null}</div>{data.results.length?<ResultTable results={data.results} type={session?.type||''}/>:isRecapMode&&data.recapResults?.length?<ResultTable results={data.recapResults} type="race"/>:<p className={styles.empty}>{phase==='FINISHED'&&session?.type==='practice'?'本节练习赛已完赛，历史档案未收录单圈详细圈速。':'本节次成绩尚未收录。排期已过不等于赛事已经结束，暂无数据不等于没有成绩。'}</p>}<div className={styles.resultSources}>{data.resultSourceUrls.map(url=>{const safe=safeExternal(url);return safe?<a key={url} href={safe} target="_blank" rel="noopener noreferrer">核对成绩来源 ↗</a>:null;})}</div></section>:null}
  <PersistentDetails id="live-timing-panels" className={styles.livePanels} defaultOpen={Boolean(rawSnapshot)}><summary>计时与赛况 <span>{rawSnapshot?connectionLabels[connection]:'完整实时计时尚不可用 · 查看详情'}</span></summary><section className={styles.timingSection} aria-labelledby="timing-title"><div className={styles.sectionHead}><div><span className="eyebrow">{session?.type==='practice'?'练习赛 · 最快圈与分段':session?.type==='qualifying'||session?.type==='sprint_qualifying'?'排位赛 · 阶段与有效圈速':'比赛 · 排名与策略'}</span><h2 id="timing-title">计时排行榜</h2></div><span className={styles.connection} role="status" data-connection={connection}>{data.isStale||connection==='DELAYED'||connection==='RECONNECTING'?'STALE · ':''}{rawSnapshot?connectionLabels[connection]:'实时来源不可用'}</span></div>
  <div className={styles.timingMeta}><span>当前圈数 <strong>{rawSnapshot?`${value(rawSnapshot.currentLap)} / ${value(rawSnapshot.totalLaps)}`:unavailable}</strong></span><span>旗语 <strong>{rawSnapshot?value(rawSnapshot.flag):unavailable}</strong></span><span>阶段 <strong>{rawSnapshot?value(rawSnapshot.segment):unavailable}</strong></span><span>阶段剩余时间 <strong>{rawSnapshot?.remainingSeconds!=null?`${Math.floor(rawSnapshot.remainingSeconds/60)}:${String(Math.floor(rawSnapshot.remainingSeconds%60)).padStart(2,'0')}`:unavailable}</strong></span></div>
  <div className={styles.toolbar}><label>筛选车手或车队<input value={filter} onChange={event=>setFilter(event.target.value)} placeholder="姓名、缩写、车号或车队" maxLength={80}/></label><label>查看顺序<select value={order} onChange={event=>setOrder(event.target.value)}><option value="position">排名</option><option value="best">最快单圈</option></select></label><label className={styles.checkbox}><input type="checkbox" checked={onlyFavorites} onChange={event=>setOnlyFavorites(event.target.checked)}/>只看关注车手</label></div>
  <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="实时计时表，可横向滚动"><table className={styles.timingTable}><caption className="sr-only">当前节次实时计时，未提供的数据明确标为暂不可用</caption><thead><tr>{['名次','车手 / 车队','最新圈速','最快圈','S1','S2','S3','领先差距','前车差距','圈数','轮胎 / 胎龄','进站 / 状态','数据时间'].map(column=><th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{rows.map(driver=><DriverRow key={driver.number} driver={driver} signature={JSON.stringify(driver)} favorite={favorites.includes(driver.number)} toggle={toggle}/>)}</tbody></table>{!rows.length?<div className={styles.noTiming}>{driversList.length?'没有符合筛选条件的车手':'暂无可公开展示的实时计时'}<small>有数据后自动更新，无需刷新。</small></div>:null}</div><p className={styles.source}>来源：{rawSnapshot?.source||data.availability.source} · 最后有效数据：{dataDate(rawSnapshot?.sourceTimestamp||null)}{sourceAge!==null&&Number.isFinite(sourceAge)?sourceAge < -5000?' · 来源时钟异常':` · 来源时间距当前约 ${Math.max(0,Math.round(sourceAge/1000))} 秒`:''}{error?' · 连接恢复前请勿将此表视为实时':''}</p></section>
  <div className={styles.lowerGrid}><section className={styles.panel}><div className={styles.sectionHead}><h2>赛会消息与旗语</h2><span>{rawSnapshot?value(rawSnapshot.flag):unavailable}</span></div>{messages.length?<ol className={styles.messages}>{messages.slice(-40).reverse().map(message=><li key={message.id}><time dateTime={message.date}>{formatTime(message.date)}</time><p>{message.text}</p></li>)}</ol>:<p className={styles.empty}>赛会消息暂不可用。未收到消息不代表赛道处于绿旗状态。</p>}</section><section className={styles.panel}><h2>赛道环境</h2><dl className={styles.weather}><div><dt>气温</dt><dd>{airTemp==null?unavailable:`${airTemp} °C`}</dd></div><div><dt>赛道温度</dt><dd>{trackTemp==null?unavailable:`${trackTemp} °C`}</dd></div><div><dt>降雨</dt><dd>{rainfall===true?'有降雨':rainfall===false?'未报告降雨':unavailable}</dd></div></dl><p className={styles.source}>仅显示来源提供的天气，不推测赛道湿度或抓地力。</p></section></div>
  </PersistentDetails>
  {nextSession&&(nextIsOtherMeeting||nextSession.id!==session?.id)?<section className={styles.next}><div><span className="eyebrow">下一节比赛</span><h2>{nextSession.name}</h2><p>{formatBeijingDisplay(nextSession.startTimeUTC)} · 北京时间</p>{nextParts?<p>{nextParts[0]} 天 {nextParts[1]} 小时 {nextParts[2]} 分 {nextParts[3]} 秒</p>:null}</div><button type="button" onClick={()=>pickSession(nextSession.id,nextIsOtherMeeting)}>查看下一节倒计时 ↗</button></section>:null}
  <footer className={styles.provenance}><p>赛程来源：{data.calendarSource} · 数据更新时间：{dataDate(data.calendarUpdatedAt)}{data.isStale?' · 当前为较旧快照，请核对官方赛程':''}</p><p>所有时间均为北京时间。页面自动检查状态；连接异常时保留最后可信数据，不把历史记录或演示标为直播。</p><PersistentDetails id="live-timing-channels"><summary>数据频道与可用范围</summary><ul>{data.availability.channels.map(channel=><li key={channel.name}><strong>{channel.name}</strong><span>{channel.status} · {channel.note}</span></li>)}</ul></PersistentDetails></footer>
  </>:!loading&&!error?<section className={styles.empty}><h2>暂时无法读取赛事</h2><p>请稍后重试，或前往官方实时计时。</p>{official?<a className="text-link" href={official} target="_blank" rel="noopener noreferrer">F1 官方实时计时 ↗</a>:null}</section>:null}
 </div></div>;
}
