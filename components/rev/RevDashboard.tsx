'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { CAR_SPECS } from '@/lib/arcade/car-specs';
import { RevSession, readRecords, saveRecord, readGhost, ghostGap, type RevMode, type RevPhase } from '@/lib/arcade/rev-session';
import { RevAudio } from '@/lib/audio/rev-audio';
import styles from './studio.module.css';

const MODES: {id: RevMode; name: string; title: string; description: string; number: string}[] = [
  {id:'DRAG',name:'DRAG RACE',title:'四百米，只争一瞬。',description:'五灯熄灭，释放离合。精准换挡，挑战你的 400 米最佳成绩。',number:'01'},
  {id:'FREE',name:'FREE REV',title:'让引擎，放声。',description:'V10 / V8 / V6。三种时代，一块属于你的油门。',number:'02'},
  {id:'LAUNCH',name:'LAUNCH CONTROL',title:'抓住起步的临界点。',description:'稳住目标转速，在灯灭的一刻释放离合。',number:'03'},
  {id:'QUIZ',name:'SOUND QUIZ',title:'闭上眼，听见答案。',description:'十段声浪，三个选项。你能认出多少种引擎？',number:'04'},
];
const specs=Object.values(CAR_SPECS);
function localRecords() {try{return readRecords(window.localStorage);}catch{return {};}}
const recordKey=(mode:RevMode,id:string)=>mode==='QUIZ'?'QUIZ':`${mode}:${id}`;
const formatBest=(mode:RevMode,value?:number)=>value===undefined?'等待你的首个纪录':mode==='QUIZ'?`${value} / 10`:mode==='LAUNCH'?`${Math.round(value)} ms`:`${value.toFixed(3)} s`;

function TrackArt({kind}:{kind:RevMode}) {
  return <svg className={styles.art} viewBox="0 0 600 240" fill="none" aria-hidden="true">
    {kind==='DRAG'?<><path d="M70 230 225 12M530 230 375 12M300 225V12" stroke="currentColor" strokeWidth="2"/><path d="m125 230 130-218m220 218L345 12" stroke="currentColor" strokeOpacity=".3"/><path d="M210 70h180M180 115h240M140 175h320" stroke="currentColor" strokeOpacity=".2"/><path d="M286 135h28v65h-28zM264 145h16v25h-16zM320 145h16v25h-16zM263 185h17v29h-17zM320 185h17v29h-17zM280 213h40" fill="currentColor"/></>:kind==='FREE'?<><path d="M130 210a170 170 0 0 1 340 0" stroke="currentColor" strokeWidth="2"/><path d="M160 210a140 140 0 0 1 280 0" stroke="currentColor" strokeWidth="12" strokeDasharray="2 18"/><path d="m300 210 80-115" stroke="currentColor" strokeWidth="4"/></>:kind==='LAUNCH'?<>{[0,1,2,3,4].map(i=><g key={i}><rect x={130+i*70} y="65" width="48" height="110" rx="24" stroke="currentColor"/><circle cx={154+i*70} cy="95" r="13" fill="currentColor"/><circle cx={154+i*70} cy="145" r="13" fill="currentColor" fillOpacity=".2"/></g>)}</>:<>{Array.from({length:39},(_,i)=><path key={i} d={`M${72+i*12} ${120-Math.sin(i*.72)**2*65}v${Math.sin(i*.72)**2*130+4}`} stroke="currentColor" strokeWidth="3"/>)}</>}
  </svg>;
}

function SoundControls({volume,muted,onVolume,onMute,compact=false}:{volume:number;muted:boolean;onVolume:(value:number)=>void;onMute:()=>void;compact?:boolean}) {
  return <div className={compact?styles.mobileAudio:styles.audio}>
    <button aria-label={muted?'取消静音':'静音'} aria-pressed={muted} onClick={onMute}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>{muted?<path d="m17 9 5 6m0-6-5 6"/>:<path d="M17 8a6 6 0 0 1 0 8"/>}</svg>{!compact&&<span>{muted?'静音中':'声音开启'}</span>}</button>
    <input aria-label="主音量" type="range" min="0" max="1" step=".05" value={volume} onChange={event=>onVolume(+event.target.value)}/>
  </div>;
}

export function RevDashboard() {
  const [mode,setMode]=useState<RevMode|null>(null);
  const [records,setRecords]=useState<Record<string,number>>({});
  const [volume,setVolume]=useState(.45),[muted,setMuted]=useState(false);
  const [audio]=useState(()=>new RevAudio());
  const onVolume=(value:number)=>{setVolume(value);audio.setVolume(value);};
  const onMute=()=>{setMuted(!muted);audio.setMuted(!muted);};
  useEffect(()=>{const id=requestAnimationFrame(()=>setRecords(localRecords()));return()=>{cancelAnimationFrame(id);audio.stop();};},[audio]);
  const exit=()=>{audio.stop();setMode(null);setRecords(localRecords());window.scrollTo({top:0,behavior:'instant'});};
  return <div className={styles.root} data-rev-active={Boolean(mode)}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headingRow}>
        <div className={styles.wordmark}><span className={styles.mark} aria-hidden="true">t</span><div><span className={styles.kicker}>tikeai / INTERACTIVE</span><h1>Acoustic Rev<span className={styles.dot}>.</span></h1></div></div>
        <SoundControls volume={volume} muted={muted} onVolume={onVolume} onMute={onMute}/>
        </div>
        {!mode&&<div className={styles.intro}><h2>听见引擎，驶入赛道。</h2><p>选择一种玩法，立即进入驾驶舱。<br/>你的每一次起步与换挡，都有回应。</p></div>}
      </header>
      {mode?<SessionView key={mode} mode={mode} audio={audio} onExit={exit} soundControls={<SoundControls compact volume={volume} muted={muted} onVolume={onVolume} onMute={onMute}/>}/>:<section className={styles.lobby} aria-label="模式大厅">
        <div className={styles.modeGrid}>{MODES.map(m=><button key={m.id} className={`${styles.modeCard} ${m.id==='DRAG'?styles.featured:''}`} onClick={()=>{setMode(m.id);window.scrollTo({top:0,behavior:'instant'});}} aria-label={`${m.name} ${m.title}`}>
          <div className={styles.modeTop}><span>{m.number} / {m.name}</span><span className={styles.arrow}>↗</span></div><TrackArt kind={m.id}/><div className={styles.modeCopy}><span className={styles.modeTag}>{m.id==='DRAG'?'400 M · FEATURED':m.id==='FREE'?'NO LIMITS':m.id==='LAUNCH'?'REACTION / PRECISION':'10 ROUNDS / LISTEN'}</span><h3>{m.title}</h3><p>{m.description}</p><div className={styles.best}>{m.id==='FREE'?'自由探索 · 无计时':`PERSONAL BEST / ${formatBest(m.id,records[recordKey(m.id,specs[0].id)])}`}</div></div>
        </button>)}</div><div className={styles.lobbyFoot}><span>三种引擎时代 / 一次纯粹的驾驶体验</span><span>程序化合成声浪 · 建议使用耳机</span></div>
      </section>}
    </div>
  </div>;
}

function SessionView({mode,audio,onExit,soundControls}:{mode:RevMode;audio:RevAudio;onExit:()=>void;soundControls:ReactNode}) {
  const [game,setGame]=useState(()=>new RevSession(mode,specs[0]));
  const [phase,setPhase]=useState<RevPhase>('READY');
  const [error,setError]=useState('');
  const [best,setBest]=useState<number | undefined>(undefined);
  const [newBest,setNewBest]=useState(false);
  const [feedback,setFeedback]=useState('');
  const title=MODES.find(m=>m.id===mode)!;
  const phaseRef=useRef(phase);
  const operation=useRef(0);
  const invalidate=useCallback(()=>{operation.current+=1;},[]);
  const heading=useRef<HTMLHeadingElement>(null);
  const sync=useCallback(()=>{
    if(phaseRef.current!==game.phase) {
      phaseRef.current=game.phase;setPhase(game.phase);
      if(game.phase==='RESULT') {
        audio.stop(); const result=game.result!;
        const value=mode==='QUIZ'?result.score:mode==='DRAG'?result.time:result.quality==='PERFECT'?result.reactionMs: undefined;
        try {const improved=value!== undefined&&!result.failed&&saveRecord(localStorage,recordKey(mode,game.spec.id),value,mode==='QUIZ');setNewBest(improved);if(improved&&mode==='DRAG')localStorage.setItem('apex_rev_ghost_v3:'+game.spec.id,JSON.stringify(game.trajectory));setBest(localRecords()[recordKey(mode,game.spec.id)]);}catch{setNewBest(false);}
      }
    }
  },[game,audio,mode]);
  useEffect(()=>{
    const id=requestAnimationFrame(()=>{setBest(localRecords()[recordKey(mode,game.spec.id)]);heading.current?.focus({preventScroll:true});});
    return()=>cancelAnimationFrame(id);
  },[game,mode]);
  useEffect(()=>{
    let frame=0,last=0,backfire=false;
    const loop=(now:number)=>{
      const dt=last?(now-last)/1000:0;last=now;game.tick(dt);
      if(!['READY','PAUSED','RESULT','ANSWER'].includes(game.phase)) {
        if(mode==='QUIZ') {
          if(game.played&&game.quizSeconds<3)audio.update(game.quizEngine.enginePreset.idleRpm+(game.quizEngine.enginePreset.redlineRpm-game.quizEngine.enginePreset.idleRpm)*(.35+.5*Math.sin(game.quizSeconds*.9)**2),.7,false);
          else if(game.played)audio.stop();
        } else {audio.update(game.telemetry.rpm,game.inputs.throttle,game.telemetry.isLimiterActive); if(game.backfire&&!backfire)audio.backfire();backfire=game.backfire;}
      }
      sync();frame=requestAnimationFrame(loop);
    };
    frame=requestAnimationFrame(loop);
    const pause=()=>{invalidate();game.pause();game.inputs.clear();audio.stop();sync();};
    const key=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement;
      if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(!['Space','KeyW','KeyE','KeyQ','ShiftLeft','ShiftRight','Escape'].includes(e.code))return;
      if(e.code==='Space'&&target.closest('button')&&!target.closest('[data-drive-control]'))return;
      e.preventDefault(); if(e.repeat)return;
      if(e.code==='Escape'){pause();return;}
      if(['Space','KeyW'].includes(e.code))game.inputs.set(e.code,1);
      if(e.code.startsWith('Shift'))game.holdClutch();
      if(e.code==='KeyE')game.shift(1); if(e.code==='KeyQ')game.shift(-1);
    };
    const up=(e:KeyboardEvent)=>{game.inputs.set(e.code,0);if(e.code.startsWith('Shift')){game.releaseClutch();sync();}};
    const visibility=()=>{if(document.hidden)pause();};
    window.addEventListener('keydown',key);window.addEventListener('keyup',up);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',visibility);
    return()=>{invalidate();cancelAnimationFrame(frame);game.inputs.clear();audio.stop();window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',visibility);};
  },[game,audio,mode,sync,invalidate]);
  const start=async()=>{
    const attempt=++operation.current;setError('');setNewBest(false);setFeedback('');game.start();sync();
    if(mode!=='QUIZ'){const ok=await audio.start(game.spec.enginePreset);if(attempt!==operation.current)return;if(!ok){game.stop();sync();setError('声音未能启动，请检查浏览器声音权限后重试。');}}
  };
  const resume=async()=>{const attempt=++operation.current;if(!game.needsAudio){game.resume();sync();return;}const ok=await audio.start((mode==='QUIZ'?game.quizEngine:game.spec).enginePreset);if(attempt!==operation.current)return;if(ok){game.resume();sync();}else setError('声音未能恢复，请重试。');};
  const choose=(id:string)=>{invalidate();audio.stop();const next=new RevSession(mode,CAR_SPECS[id]);setGame(next);phaseRef.current='READY';setPhase('READY');setError('');setNewBest(false);};
  const quizPlay=async()=>{const attempt=++operation.current;setError('');const ok=await audio.start(game.quizEngine.enginePreset);if(attempt!==operation.current)return;if(ok){game.playQuiz();setFeedback('播放中 · 再次点击可重听');}else setError('声音未能播放，请检查浏览器声音权限。');};
  const answer=(id:string)=>{game.answer(id);audio.stop();sync();};
  const isDriving=!['READY','RESULT','PAUSED'].includes(phase);
  return <section className={styles.session} data-mode={mode} data-phase={phase}>
    <div className={styles.sessionHead}><button className={styles.back} onClick={onExit}>← 模式大厅</button><h2 ref={heading} tabIndex={-1}>{title.name}</h2>{soundControls}{isDriving?<button className={styles.back} onClick={()=>{invalidate();game.pause();audio.stop();sync();}}>暂停</button>:<span className={styles.kicker}>{mode==='DRAG'?'400 METRES':mode==='QUIZ'?'LISTEN / IDENTIFY':'tikeai SOUND LAB'}</span>}</div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {phase==='RESULT'?<Result game={game} best={best} newBest={newBest} retry={start} exit={onExit}/>:phase==='PAUSED'?<div className={styles.intermission}><span className={styles.kicker}>SESSION PAUSED</span><h3>回到你的节奏。</h3><p>游戏计时已冻结，油门已释放。准备好后继续。</p><button className={styles.primary} onClick={resume}>继续游戏</button><button className={styles.secondary} onClick={start}>重新开始</button></div>:mode==='QUIZ'?<div className={styles.quiz}>
      <div className={styles.quizTop}><span>声学识别 / {Math.min(10,game.question+1).toString().padStart(2,'0')} OF 10</span><span>得分 {game.score} · 连击 {game.streak}</span></div>
      <h3>{phase==='READY'?'用耳朵，认出一个时代。':phase==='ANSWER'?'听觉，留下了答案。':'这是谁的声音？'}</h3><p>身份与转速已隐藏。聆听后，选择你听到的引擎。</p>
      <Spectrum game={game} audio={audio}/>
      {phase==='READY'?<button className={styles.primary} onClick={start}>开始十题挑战</button>:<><button className={styles.primary} onClick={quizPlay} disabled={phase==='ANSWER'}>播放 / 重听声浪</button><p className={styles.audioStatus} aria-live="polite">{phase==='ANSWER'?game.feedback:feedback||'点击播放后选择答案'}</p><div className={styles.options}>{specs.map(s=><button key={s.id} disabled={!game.played||phase==='ANSWER'} onClick={()=>answer(s.id)} data-correct={phase==='ANSWER'&&s.id===game.quizEngine.id}>{s.shortName}{phase==='ANSWER'&&s.id===game.quizEngine.id?' · 正确答案':''}{phase==='ANSWER'&&s.id===game.lastAnswer?' · 你的选择':''}</button>)}</div>{phase==='ANSWER'&&<button className={styles.secondary} onClick={()=>{game.nextQuestion();setFeedback('');sync();}}>{game.question===9?'查看成绩':'下一题 →'}</button>}</>}
    </div>:<>
      <div className={styles.engineRow}><div className={styles.engineChoices} role="group" aria-label="选择赛车">{specs.map(s=><button key={s.id} aria-pressed={game.spec.id===s.id} disabled={isDriving} onClick={()=>choose(s.id)}>{s.shortName}<small>{s.totalGears} 挡 / {s.massKg} kg</small></button>)}</div><div className={styles.preBest}><span>PERSONAL BEST</span><strong>{mode==='FREE'?'N / 自由声浪':formatBest(mode,best)}</strong></div></div>
      <div className={`${styles.cockpit} ${mode==='LAUNCH'?styles.launchCockpit:''}`}>
        <Instruments key={game.spec.id} game={game}/>
        {phase==='READY'?<div className={styles.gridReady}><span className={styles.kicker}>{mode==='FREE'?'IGNITION SEQUENCE':mode==='DRAG'?'READY ON THE GRID':'FIND THE SWEET SPOT'}</span><h3>{mode==='FREE'?'唤醒机械脉搏。':mode==='DRAG'?'你的下一次最快。':'稳定，然后出击。'}</h3><p>{mode==='FREE'?'启动引擎，按住 Space / W 或拖动油门。':mode==='DRAG'?'按住油门预热，五灯熄灭后释放离合。E 升挡 / Q 降挡。':'将油门保持在目标区间 1.2 秒。五灯熄灭后释放离合，完成挑战。'}</p><button className={styles.primary} onClick={start}>{mode==='FREE'?'启动引擎':mode==='DRAG'?'开始比赛':'开始起步挑战'} →</button><span className={styles.simulation}>交互模拟 · 非真实赛车性能测定</span></div>:<div className={styles.controls}>
          <div className={styles.controlLeft}>{mode==='FREE'?<><span className={styles.neutral}>N<span>NEUTRAL</span></span><button className={styles.secondary} onClick={()=>{game.stop();audio.stop();sync();}}>熄火</button></>:<><button data-drive-control className={styles.clutch} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);game.holdClutch();}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);game.releaseClutch();sync();}} onPointerCancel={()=>{game.pause();audio.stop();sync();}} onKeyDown={e=>{if(e.key==='Enter'){game.releaseClutch();sync();}}}>离合<span>按住 → 松开起步</span><small>SHIFT / ENTER</small></button>{mode==='DRAG'&&<div className={styles.shifts}><button data-drive-control aria-label="降挡 Q" onPointerDown={e=>{e.preventDefault();game.shift(-1);}} onKeyDown={e=>{if(e.key==='Enter')game.shift(-1);}}>− <small>Q</small></button><button data-drive-control aria-label="升挡 E" onPointerDown={e=>{e.preventDefault();game.shift(1);}} onKeyDown={e=>{if(e.key==='Enter')game.shift(1);}}>+ <small>E</small></button></div>}</>}</div>
          <Pedal game={game}/>
        </div>}
      </div>
      <div className={styles.drivingFoot}><span>{mode==='FREE'?'保持空挡 · 松开油门释放':mode==='LAUNCH'?`目标 ${game.spec.launchRpmMin.toLocaleString()}–${game.spec.launchRpmMax.toLocaleString()} RPM`:'SPACE / W 油门 · SHIFT 离合 · E / Q 换挡'}</span><span>ESC 暂停 · 切到后台自动暂停</span></div>
    </>}
  </section>;
}

function Pedal({game}:{game:RevSession}) {
  const drag=useRef<{id:number;y:number;top:number;height:number}|null>(null);
  const down=(e:PointerEvent<HTMLButtonElement>)=>{if(drag.current)return;const r=e.currentTarget.getBoundingClientRect();drag.current={id:e.pointerId,y:e.clientY,top:r.top,height:r.height};e.currentTarget.setPointerCapture(e.pointerId);game.inputs.set(`pointer:${e.pointerId}`,Math.max(.12,Math.min(1,1-(e.clientY-r.top)/r.height)));};
  const move=(e:PointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(d?.id!==e.pointerId)return;game.inputs.set(`pointer:${e.pointerId}`,Math.max(0,Math.min(1,1-(e.clientY-d.top)/d.height)));};
  const release=(e:PointerEvent<HTMLButtonElement>)=>{game.inputs.set(`pointer:${e.pointerId}`,0);if(drag.current?.id===e.pointerId)drag.current=null;};
  return <button data-drive-control className={styles.pedal} aria-label="油门，向上滑动增加开度；按住 Space 或 W" onPointerDown={down} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onKeyDown={e=>{if(e.key==='Enter')game.inputs.set('Enter',1);}} onBlur={()=>game.inputs.set('Enter',0)} onKeyUp={e=>{if(e.key==='Enter')game.inputs.set('Enter',0);}}><span className={styles.pedalLines} aria-hidden="true"/><span>↑ 向上滑动增加</span><strong>THROTTLE</strong><small>按住 SPACE / W</small></button>;
}

/** Only this small telemetry subtree refreshes at 15Hz; physics stays at 120Hz. */
function Instruments({game}:{game:RevSession}) {
  const [,refresh]=useState(0);
  useEffect(()=>{const timer=setInterval(()=>refresh(v=>v+1),66);return()=>clearInterval(timer);},[]);
  const t=game.telemetry,preset=game.spec.enginePreset;
  const ratio=Math.min(1,t.rpm/preset.limiterRpm),throttle=game.inputs.throttle;
  const target=t.rpm>=game.spec.launchRpmMin&&t.rpm<=game.spec.launchRpmMax;
  const drag=game.mode==='DRAG',launch=game.mode==='LAUNCH';
  return <div className={styles.instruments} data-rpm={t.rpm} data-speed={t.speedKmh} data-gear={t.gear}>
    {game.mode!=='FREE'&&<div className={styles.startRow}><div className={styles.lights} aria-label={game.phase==='COUNTDOWN'?`${game.lightCount} 盏红灯`:game.phase==='GO'?'灯灭，起步':'发车灯待命'}>{[0,1,2,3,4].map(i=><i key={i} data-lit={game.phase==='COUNTDOWN'&&i<game.lightCount}/>)}</div><span className={styles.startPrompt}>{game.phase==='COUNTDOWN'?'保持油门 · 等待灯灭':game.phase==='GO'?'LIGHTS OUT · 释放离合':game.phase==='STABILIZE'?'保持目标区间 1.2 秒':game.phase==='RACING'?'400 M / FULL THROTTLE':'FIVE LIGHTS. ONE MOMENT.'}</span></div>}
    <div className={styles.leds} aria-label="15 颗换挡指示灯">{Array.from({length:15},(_,i)=><i key={i} data-lit={ratio>(.48+i*.033)} data-color={i<5?'green':i<10?'red':'blue'}/>)}</div>
    <div className={`${styles.dial} ${drag?styles.speedDial:''}`}>
      <svg viewBox="0 0 480 260" aria-hidden="true"><path d="M44 226a196 196 0 1 1 392 0" className={styles.arcTrack}/><path d="M44 226a196 196 0 1 1 392 0" className={styles.arcActive} pathLength="100" strokeDasharray={`${ratio*100} 100`}/>{Array.from({length:21},(_,i)=>{const a=Math.PI+i*Math.PI/20;return <line key={i} x1={240+Math.cos(a)*175} y1={226+Math.sin(a)*175} x2={240+Math.cos(a)*(i%5===0?160:168)} y2={226+Math.sin(a)*(i%5===0?160:168)} stroke="currentColor" opacity=".4"/>;})}<g className={styles.needle} style={{transform:`rotate(${ratio*180-90}deg)`,transformOrigin:'240px 226px'}}><path d="M240 226V60" stroke="currentColor" strokeWidth="2"/></g></svg>
      <div className={styles.dialValue}><span className={styles.kicker}>{drag?'VELOCITY':launch?'LAUNCH RPM':'ENGINE SPEED'}</span><strong data-testid={drag?'speed':'rpm'}>{Math.round(drag?t.speedKmh:t.rpm).toLocaleString('en-US')}</strong><span>{drag?'KM/H':'RPM'}</span>{drag?<div className={styles.gear}>GEAR <b>{t.gear||'N'}</b><span>{t.rpm.toLocaleString('en-US')} RPM</span></div>:<span className={styles.dialCaption}>{launch?target?'目标区间内':'调整油门，寻找目标区间':game.spec.shortName+' / NEUTRAL'}</span>}</div>
    </div>
    {launch&&<div className={styles.stability}><span>{target?'转速已进入目标区间':'转速未稳定'} / {Math.min(100,Math.round(game.stable/1.2*100))}%</span><div role="progressbar" aria-label="转速稳定度" aria-valuenow={Math.min(100,Math.round(game.stable/1.2*100))} aria-valuemin={0} aria-valuemax={100}><i style={{transform:`scaleX(${Math.min(1,game.stable/1.2)})`}}/></div><small>目标 {game.spec.launchRpmMin.toLocaleString()}–{game.spec.launchRpmMax.toLocaleString()} RPM</small></div>}
    <div className={styles.feedback} role="status">{t.isLimiterActive?'REV LIMITER':game.feedback||'\u00a0'}</div>
    {drag&&<><div className={styles.raceStats}><div><span>TIME</span><strong>{(game.raceTime+(game.reactionMs??0)/1000).toFixed(3)}<small> s</small></strong></div><div><span>DISTANCE</span><strong>{Math.min(400,Math.round(t.distanceM))}<small> / 400 m</small></strong></div><Ghost game={game}/></div><div className={styles.progress} role="progressbar" aria-label="400 米进度" aria-valuemin={0} aria-valuemax={400} aria-valuenow={Math.min(400,t.distanceM)}><i style={{transform:`scaleX(${Math.min(1,t.distanceM/400)})`}}/></div></>}
    <div className={styles.inputStatus}><span>THROTTLE <b>{Math.round(throttle*100)}%</b></span><div><i style={{transform:`scaleX(${throttle})`}}/></div>{game.mode!=='FREE'&&<span>CLUTCH <b>{game.clutch?'保持':'释放'}</b></span>}{game.mode==='FREE'&&<span className={game.backfire?styles.backfire:''}>{game.backfire?'EXHAUST / BACKFIRE':'EXHAUST / IDLE'}</span>}</div>
  </div>;
}
function Ghost({game}:{game:RevSession}) {
  const [points]=useState(()=>{try{return readGhost(localStorage,game.spec.id);}catch{return [];}});
  const gap=game.phase==='RACING'?ghostGap(points,game.telemetry.distanceM,game.raceTime+(game.reactionMs??0)/1000):null;
  return <div><span>PB GHOST / DELTA</span><strong>{gap===null?'—':`${gap>=0?'+':''}${gap.toFixed(2)}`}<small> s</small></strong></div>;
}function Spectrum({game,audio}:{game:RevSession;audio:RevAudio}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;
    const data=new Uint8Array(32);let frame=0,last=0;
    const draw=(now:number)=>{if(now-last>50){last=now;audio.spectrum(data);ctx.clearRect(0,0,800,180);ctx.fillStyle='#f49a95';for(let i=0;i<32;i++){const h=Math.max(3,data[i]/255*150);ctx.fillRect(15+i*24,(180-h)/2,9,h);}}frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[audio]);
  return <div className={styles.spectrum}><canvas width="800" height="180" ref={canvas} aria-label="实时音频频谱" role="img"/><span>{game.phase==='READY'?'SOUND AWAITS YOUR INPUT':'LIVE AUDIO SPECTRUM'}</span></div>;
}
function Result({game,best,newBest,retry,exit}:{game:RevSession;best?:number;newBest:boolean;retry:()=>void;exit:()=>void}) {
  const result=game.result!;
  const focus=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{focus.current?.focus({preventScroll:true});},[]);
  const rank=result.failed?'—':game.mode==='QUIZ'?result.score!>=9?'S':result.score!>=6?'A':'B':game.mode==='LAUNCH'?result.quality==='PERFECT'&&result.reactionMs!<250?'S':result.quality==='PERFECT'?'A':'B':result.perfect!>=3?'S':result.perfect!>=1?'A':'B';
  return <div className={styles.result} data-failed={Boolean(result.failed)}>
    <span className={styles.kicker}>{newBest?'NEW PERSONAL BEST':'SESSION COMPLETE'}</span><h3 ref={focus} tabIndex={-1}>{result.failed?'下一次，找准时机。':newBest?'快过从前的自己。':game.mode==='QUIZ'?'每一次聆听，都更敏锐。':'这一刻，值得记住。'}</h3>
    <div className={styles.resultHero}><strong>{result.failed?'抢跑 / 超时':game.mode==='QUIZ'?`${result.score} / 10`:game.mode==='LAUNCH'?result.reactionMs:result.time!.toFixed(3)}<small>{result.failed?'':game.mode==='QUIZ'?'CORRECT':game.mode==='LAUNCH'?'ms / REACTION':'s / 400 METRES'}</small></strong><div className={styles.rank}><span>RATING</span><b>{rank}</b></div></div>
    <p role="status">{result.quality?({PERFECT:'完美起步 · 转速在目标区间',GOOD:'良好起步',WHEEL_SPIN:'转速偏高 · 车轮打滑',BOG_DOWN:'转速偏低 · 动力迟滞'}[result.quality]||result.quality):game.mode==='QUIZ'?`识别正确 ${result.score} 题，继续磨练你的听觉。`:'计时从灯灭开始，包含反应时间。'}</p>
    <div className={styles.resultStats}>{game.mode==='DRAG'&&!result.failed&&<><div><span>0–100 KM/H</span><b>{result.zero100?.toFixed(3)??'—'} s</b></div><div><span>0–200 KM/H</span><b>{result.zero200?.toFixed(3)??'—'} s</b></div><div><span>REACTION</span><b>{result.reactionMs} ms</b></div><div><span>PERFECT SHIFTS</span><b>{result.perfect}</b></div></>}<div><span>PERSONAL BEST</span><b>{formatBest(game.mode,best)}</b></div></div>
    <div className={styles.resultActions}><button className={styles.primary} onClick={retry}>再来一局 →</button><button className={styles.secondary} onClick={exit}>返回模式大厅</button></div>
  </div>;
}
