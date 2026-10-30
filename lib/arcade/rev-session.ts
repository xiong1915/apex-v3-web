import { CAR_SPECS, type CarSpec } from './car-specs';
import { DragPhysicsEngine, type DragRaceTelemetry } from './drag-physics';
import { RevPhysicsSimulator } from '../audio/rev-physics';

export type RevMode = 'FREE' | 'DRAG' | 'LAUNCH' | 'QUIZ';
export type RevPhase = 'READY' | 'FREE' | 'STABILIZE' | 'COUNTDOWN' | 'GO' | 'RACING' | 'QUIZ' | 'ANSWER' | 'RESULT' | 'PAUSED';
export interface RevResult { failed?: boolean; time?: number; reactionMs?: number; quality?: string; zero100?: number | null; zero200?: number | null; perfect?: number; score?: number; }
export interface RevGhostPoint { time: number; distance: number; }
export class RevInputs {
  private sources = new Map<string, number>();
  set(source: string, value: number) { if (value > 0 && Number.isFinite(value)) this.sources.set(source, Math.min(1,value)); else this.sources.delete(source); }
  get throttle() { return Math.max(0, ...this.sources.values()); }
  clear() { this.sources.clear(); }
}

/** Pure simulation clock. No DOM, timers, audio or React state. */
export class RevSession {
  phase: RevPhase = 'READY';
  inputs = new RevInputs();
  elapsed = 0;
  raceTime = 0;
  stable = 0;
  clutch = true;
  lightCount = 0;
  reactionMs: number | null = null;
  result: RevResult | null = null;
  feedback = '';
  feedbackRemaining = 0;
  backfire = false;
  question = 0;
  score = 0;
  streak = 0;
  played = false;
  quizSeconds = 0;
  quizEngine: CarSpec;
  lastAnswer = '';
  telemetry: DragRaceTelemetry;
  trajectory: RevGhostPoint[] = [];
  private drag: DragPhysicsEngine;
  private free: RevPhysicsSimulator;
  private previous: RevPhase = 'READY';
  private countdownEnd = 4.2;
  private greenElapsed = 0;
  private remainder = 0;

  constructor(public mode: RevMode, public spec: CarSpec, private random: () => number = Math.random) {
    this.drag = new DragPhysicsEngine(spec);
    this.free = new RevPhysicsSimulator(spec.enginePreset, false);
    this.telemetry = this.drag.step(1/120,0,false);
    this.quizEngine = spec;
  }
  start() {
    this.inputs.clear(); this.drag.reset(); this.free.reset(0); this.free.setIgnited(this.mode === 'FREE');
    this.phase = this.mode === 'FREE' ? 'FREE' : this.mode === 'QUIZ' ? 'QUIZ' : this.mode === 'LAUNCH' ? 'STABILIZE' : 'COUNTDOWN';
    this.elapsed=0; this.raceTime=0; this.greenElapsed=0; this.stable=0; this.clutch=true; this.reactionMs=null;
    this.result=null; this.feedback=''; this.feedbackRemaining=0; this.lightCount=0; this.remainder=0;
    this.trajectory=[];
    this.question=0; this.score=0; this.streak=0; this.played=false; this.quizSeconds=0; this.backfire=false;
    this.countdownEnd=4.2+this.random()*1.2; this.pickQuiz();
    this.telemetry=this.drag.step(1/120,0,false);
  }
  stop() { this.inputs.clear(); this.phase='READY'; this.free.setIgnited(false); this.telemetry={...this.telemetry,rpm:0}; }
  pause() {
    if (['READY','RESULT','PAUSED'].includes(this.phase)) return;
    this.previous=this.phase; this.phase='PAUSED'; this.inputs.clear();
  }
  resume() { if(this.phase==='PAUSED') {this.phase=this.previous; this.inputs.clear();} }
  get needsAudio() {
    const phase=this.phase==='PAUSED'?this.previous:this.phase;
    return phase==='QUIZ'?this.played&&this.quizSeconds<3:!['READY','RESULT','ANSWER'].includes(phase);
  }
  shift(direction: number) {
    if(this.phase!=='RACING') return;
    const event=direction>0?this.drag.shiftUp():this.drag.shiftDown();
    if(event.success) {this.feedback=direction>0 && 'quality' in event ? `${event.quality} SHIFT` : 'DOWNSHIFT'; this.feedbackRemaining=.8;}
    else if('reason' in event) {this.feedback='过转保护'; this.feedbackRemaining=.8;}
  }
  holdClutch() { if(['STABILIZE','COUNTDOWN','GO'].includes(this.phase)) this.clutch=true; }
  releaseClutch() {
    if(!['STABILIZE','COUNTDOWN','GO'].includes(this.phase)) return;
    this.clutch=false;
    if(this.phase!=='GO') {this.finish({failed:true,quality:'抢跑 · 等待五灯熄灭'}); return;}
    this.reactionMs=Math.round(this.greenElapsed*1000);
    const {quality}=this.drag.launch();
    if(this.mode==='LAUNCH') this.finish({reactionMs:this.reactionMs,quality});
    else {this.phase='RACING'; this.feedback=quality==='PERFECT'?'PERFECT LAUNCH':quality==='WHEEL_SPIN'?'车轮打滑':quality==='BOG_DOWN'?'起步转速偏低':'GOOD LAUNCH'; this.feedbackRemaining=1;}
  }
  playQuiz() { if(this.phase==='QUIZ') {this.played=true; this.quizSeconds=0;} }
  answer(id: string) {
    if(this.phase!=='QUIZ'||!this.played) return;
    const correct=id===this.quizEngine.id;
    if(correct) {this.score++; this.streak++;} else this.streak=0;
    this.lastAnswer=id; this.feedback=correct?'回答正确':`回答错误 · 正确答案 ${this.quizEngine.shortName}`;
    this.phase='ANSWER';
  }
  nextQuestion() {
    if(this.phase!=='ANSWER') return;
    this.question++;
    if(this.question>=10) this.finish({score:this.score});
    else {this.phase='QUIZ'; this.played=false; this.quizSeconds=0; this.feedback=''; this.pickQuiz();}
  }
  private pickQuiz() { const values=Object.values(CAR_SPECS); this.quizEngine=values[Math.min(values.length-1,Math.floor(this.random()*values.length))]; }
  private finish(result: RevResult) {this.result=result; this.phase='RESULT'; this.inputs.clear(); this.backfire=false;}
  tick(seconds: number) {
    if(!Number.isFinite(seconds)||seconds<=0||['READY','RESULT','PAUSED','ANSWER'].includes(this.phase)) return;
    // Bound foreground stalls; background is explicitly paused by the adapter.
    this.remainder+=Math.min(seconds,.25);
    while(this.remainder>=1/120) {this.remainder-=1/120; this.step(1/120);}
  }
  private step(dt: number) {
    if(['RESULT','PAUSED','ANSWER'].includes(this.phase)) return;
    const throttle=this.inputs.throttle;
    if(this.feedbackRemaining>0) {this.feedbackRemaining-=dt; if(this.feedbackRemaining<=0)this.feedback='';}
    if(this.phase==='QUIZ') {if(this.played)this.quizSeconds+=dt; return;}
    if(this.phase==='FREE') {
      const s=this.free.step(dt,throttle); this.backfire=s.isBackfiring;
      this.telemetry={...this.telemetry,rpm:s.rpm,isLimiterActive:s.isLimiterActive}; return;
    }
    if(this.phase==='STABILIZE') {
      const rpm=this.telemetry.rpm;
      this.stable=rpm>=this.spec.launchRpmMin&&rpm<=this.spec.launchRpmMax?this.stable+dt:0;
      if(this.stable>=1.2) {this.phase='COUNTDOWN'; this.elapsed=0;}
    }
    if(this.phase==='COUNTDOWN') {
      this.elapsed+=dt; this.lightCount=Math.min(5,Math.floor(this.elapsed/.6)+1);
      if(this.elapsed>=this.countdownEnd) {this.phase='GO'; this.lightCount=0; this.greenElapsed=0;}
    } else if(this.phase==='GO'||this.phase==='RACING') this.greenElapsed+=dt;
    if(this.phase==='GO' && this.greenElapsed>8) {this.finish({failed:true,quality:'发车超时 · 请在灭灯后释放离合'}); return;}
    if(this.phase==='RACING') this.raceTime+=dt;
    this.telemetry=this.drag.step(dt,throttle,this.phase==='RACING');
    if(this.phase==='RACING' && (this.trajectory.length===0 || this.greenElapsed-this.trajectory[this.trajectory.length-1].time>=.1 || this.telemetry.isFinished)) this.trajectory.push({time:this.greenElapsed,distance:this.telemetry.distanceM});
    if(this.telemetry.isFinished) this.finish({time:this.greenElapsed,reactionMs:this.reactionMs??0,zero100:this.telemetry.time0To100,zero200:this.telemetry.time0To200,perfect:this.telemetry.perfectShiftCount});
    if(this.raceTime>60) this.finish({failed:true,quality:'比赛超时 · 保持油门并及时升挡'});
  }
}

export type RecordStorage = Pick<Storage,'getItem'> & Partial<Pick<Storage,'setItem'>>;
const RECORD_KEY='apex_rev_personal_v3';
export function readRecords(storage: RecordStorage): Record<string,number> {
  const records:Record<string,number>={};
  try {
    const legacy=JSON.parse(storage.getItem('apex_rev_arcade_records_v2')||'{}');
    for(const id of Object.keys(CAR_SPECS)) {
      const record=legacy?.[id];
      if(record&&Number.isFinite(record.time400m)&&record.time400m>0&&Number.isFinite(record.reactionTimeMs)&&record.reactionTimeMs>=0)records[`DRAG:${id}`]=record.time400m+record.reactionTimeMs/1000;
    }
  }catch{/* Old records are optional; a damaged legacy payload cannot hide current records. */}
  try {const data=JSON.parse(storage.getItem(RECORD_KEY)||'{}'); if(data&&typeof data==='object'&&!Array.isArray(data))Object.assign(records,Object.fromEntries(Object.entries(data).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)&&v>=0)));}catch{/* Storage may be blocked or the payload may be corrupt. */}
  return records;
}
export function saveRecord(storage: RecordStorage,key: string,value: number,higher=false) {
  if(!Number.isFinite(value)||value<0)return false;
  const records=readRecords(storage),best=records[key];
  if(best!==undefined && (higher?value<=best:value>=best))return false;
  try {if(!storage.setItem)return false; storage.setItem(RECORD_KEY,JSON.stringify({...records,[key]:value})); return true;} catch{return false;}
}

export function readGhost(storage: RecordStorage,id:string): RevGhostPoint[] {
  try {const value=JSON.parse(storage.getItem(`apex_rev_ghost_v3:${id}`)||'[]');if(!Array.isArray(value)||value.length>650)return [];let time=-1,distance=-1;for(const p of value){if(!p||!Number.isFinite(p.time)||!Number.isFinite(p.distance)||p.time<=time||p.distance<distance||p.distance<0||p.time>70)return [];time=p.time;distance=p.distance;}return value;}catch{return [];}
}
/** Time gap to the actual best lap at the same distance, with linear interpolation. */
export function ghostGap(points:RevGhostPoint[],distance:number,time:number):number|null {
  if(points.length<2||distance<points[0].distance||distance>points[points.length-1].distance)return null;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(b.distance>=distance){const fraction=(distance-a.distance)/Math.max(.001,b.distance-a.distance);return time-(a.time+(b.time-a.time)*fraction);}}
  return null;
}
