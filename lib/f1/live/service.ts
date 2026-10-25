import {Redis} from '@upstash/redis';
import {defaultF1Service, type DataFetchResult} from '@/providers/f1/service';
import {getCacheStore,getStorageInfo} from '@/lib/storage';
import type {CacheStore} from '@/lib/storage/interfaces';
import type {F1Meeting, F1Session, DetailedRaceResultItem, DetailedQualifyingResultItem, DetailedSprintResultItem} from '../types';
import type {PublicLiveResponse, LiveResult} from './public-types';
import {LIVE_PUBLIC_POLICY, PUBLIC_LIVE_CHANNELS} from './policy';

export class LiveRequestError extends Error {constructor(message:string,public status=400){super(message);}}
export interface LiveQuery {season:string;round?:number;session?:string}
export function parseLiveQuery(params:URLSearchParams,year=new Date().getUTCFullYear()):LiveQuery {
 const season=params.get('season')||String(year),round=params.get('round'),session=params.get('session');
 if(!/^\d{4}$/.test(season)||Number(season)<1950||Number(season)>year+1)throw new LiveRequestError('赛季无效');
 if(round!==null&&(!/^\d{1,2}$/.test(round)||Number(round)<1||Number(round)>30))throw new LiveRequestError('分站无效');
 if(session!==null&&!/^[A-Za-z0-9_-]{1,64}$/.test(session))throw new LiveRequestError('节次无效');
 return {season,...(round!==null?{round:Number(round)}:{}),...(session!==null?{session}: {})};
}
interface Dependencies {
 now:()=>number; persistent:boolean; cache:CacheStore; coordinator:{acquire:(key:string)=>Promise<boolean>;release?:(key:string)=>Promise<void>};sleep:(ms:number)=>Promise<void>;
 calendar:(season:string)=>Promise<DataFetchResult<F1Meeting[]>>;
 race:(season:string,round:number)=>Promise<DetailedRaceResultItem[]>;
 qualifying:(season:string,round:number)=>Promise<DetailedQualifyingResultItem[]>;
 sprint:(season:string,round:number)=>Promise<DetailedSprintResultItem[]>;
}
interface Envelope {storedAt:number;data:PublicLiveResponse}
const REFRESH_MS=10000,MAX_STALE_MS=300000;
function start(session:F1Session){return Date.parse(session.startTimeUTC);}
function sortedSessions(meeting:F1Meeting){return [...meeting.sessions].sort((a,b)=>(start(a)||Infinity)-(start(b)||Infinity));}
function defaultMeeting(calendar:F1Meeting[],now:number){
 const sorted=[...calendar].sort((a,b)=>Date.parse(a.raceStartUTC)-Date.parse(b.raceStartUTC));
 return sorted.find(m=>Date.parse(m.raceStartUTC)+12*3600000>=now)||sorted.at(-1)||null;
}
function selectedSession(sessions:F1Session[],requested:string):F1Session|null {
 const exact=sessions.find(s=>s.id===requested);if(exact)return exact;
 // Legacy links identify session kinds, not synthetic session IDs or qualifying phases.
 const alias=requested.toLowerCase().replaceAll('_','-');
 const types:Record<string,F1Session['type']>={race:'race',qualifying:'qualifying',quali:'qualifying',sprint:'sprint','sprint-qualifying':'sprint_qualifying','sprint-quali':'sprint_qualifying'};
 const type=types[alias];if(type)return sessions.find(s=>s.type===type)||null;
 const practice=/^fp([123])$/.exec(alias);
 if(practice){const n=practice[1];return sessions.find(s=>s.type==='practice'&&(new RegExp(`^fp${n}(?:-|_|$)`,'i').test(s.id)||[`fp${n}`,`practice${n}`,`freepractice${n}`].includes(s.nameEn.toLowerCase().replace(/[^a-z0-9]/g,''))))||null;}
 return null;
}
function defaultSession(meeting:F1Meeting,now:number){
 const sessions=sortedSessions(meeting);
 // The planned window selects a useful screen only; it NEVER confirms race state.
 return sessions.find(s=>Number.isFinite(start(s))&&start(s)<=now&&now<=start(s)+(s.durationMinutes||60)*60000)
  ||sessions.find(s=>start(s)>now)||sessions.at(-1)||null;
}
function row(item:DetailedRaceResultItem|DetailedQualifyingResultItem|DetailedSprintResultItem):LiveResult {
 return {position:item.position,number:item.driverNumber||null,code:item.driverCode||'',name:item.driverName,team:item.constructorName,
  laps:'laps'in item?item.laps:null,time:'time'in item?item.time||null:null,status:'status'in item?item.status:null,points:'points'in item?item.points:null,
  ...('q1'in item&&item.q1?{q1:item.q1}:{}),...('q2'in item&&item.q2?{q2:item.q2}:{}),...('q3'in item&&item.q3?{q3:item.q3}:{})};
}
export class LivePublicService {
 private pending=new Map<string,Promise<PublicLiveResponse>>();
 constructor(private deps:Dependencies){}
 async getSnapshot(query:LiveQuery):Promise<PublicLiveResponse>{
  const key=`f1:live:v33:public:${query.season}:${query.round||'current'}:${query.session||'next'}`;
  const pending=this.pending.get(key);if(pending)return pending;
  const task=this.read(key,query);this.pending.set(key,task);
  try{return await task;}finally{if(this.pending.get(key)===task)this.pending.delete(key);}
 }
 private stamp(data:PublicLiveResponse,stale=false):PublicLiveResponse{
  const now=this.deps.now();
  return {...data,serverTime:new Date(now).toISOString(),isStale:data.isStale||stale,
   // Enforce public policy again when reading cache. Stored/private payloads cannot enable forwarding.
   snapshot:null,availability:{...LIVE_PUBLIC_POLICY,channels:PUBLIC_LIVE_CHANNELS.map(c=>({...c}))},
   sessions:data.sessions.map(item=>item.phase==='UPCOMING'&&start(item.session)<=now?{...item,phase:'WAITING',reason:'等待赛事正式开始，尚未收到可信开始状态'}:item)};
 }
 private async read(key:string,query:LiveQuery):Promise<PublicLiveResponse>{
  const cached=await this.deps.cache.get<Envelope>(key),now=this.deps.now();
  if(cached&&now>=cached.storedAt&&now-cached.storedAt<REFRESH_MS)return this.stamp(cached.data);
  const last=await this.deps.cache.get<Envelope>(key+':last');
  const fallback=()=>last&&now>=last.storedAt&&now-last.storedAt<=MAX_STALE_MS?this.stamp(last.data,true):null;
  if(!this.deps.persistent){const known=fallback();if(known)return known;throw new LiveRequestError('共享数据服务暂不可用，请稍后重试',503);}
  let acquired=false;
  try{acquired=await this.deps.coordinator.acquire(key+':refresh');}catch{const known=fallback();if(known)return known;throw new LiveRequestError('共享数据服务暂不可用，请稍后重试',503);}
  if(!acquired){
   const known=fallback();if(known)return known;
   for(let i=0;i<8;i++){await this.deps.sleep(200);const value=await this.deps.cache.get<Envelope>(key);if(value&&this.deps.now()-value.storedAt<REFRESH_MS)return this.stamp(value.data);}
   throw new LiveRequestError('赛事数据正在同步，请稍后重试',503);
  }
  try{
   const data=await this.load(query),value={storedAt:this.deps.now(),data};
   await Promise.all([this.deps.cache.set(key,value,15),this.deps.cache.set(key+':last',value,300)]);
   return this.stamp(data);
  }catch(error){if(error instanceof LiveRequestError&&error.status<500)throw error;const known=fallback();if(known)return known;throw new LiveRequestError('赛事数据暂不可用，请稍后重试',503);}
  finally {await this.deps.coordinator.release?.(key+':refresh').catch(()=>{});}
 }
 private async load(query:LiveQuery):Promise<PublicLiveResponse>{
  const now=this.deps.now(),calendar=await this.deps.calendar(query.season);
  if(calendar.source==='unavailable'||!calendar.data.length)throw new LiveRequestError('赛程来源暂不可用',503);
  const meetings=calendar.data.filter(m=>m.season===query.season&&m.round>0),meeting=query.round?meetings.find(m=>m.round===query.round)||null:defaultMeeting(meetings,now);
  if(!meeting)throw new LiveRequestError('未找到该分站',404);
  const sessions=sortedSessions(meeting),session=query.session?selectedSession(sessions,query.session):defaultSession(meeting,now);
  if(query.session&&!session)throw new LiveRequestError('未找到该节次',400);
  const byType=new Map<string,LiveResult[]>();
  const due=(type:string)=>sessions.some(s=>s.type===type&&Number.isFinite(start(s))&&start(s)<=now);
  await Promise.all((['race','qualifying','sprint'] as const).map(async type=>{
   if(!due(type))return;
   const records=await this.deps[type](query.season,meeting.round);
   // Scope is enforced by the canonical provider; malformed/empty responses are not results evidence.
   byType.set(type,records.filter(item=>Number.isInteger(item.position)&&item.position>0&&item.driverId&&item.driverName).map(row));
  }));
  const states:PublicLiveResponse['sessions']=sessions.map(s=>{
   const records=Number.isFinite(start(s))&&start(s)<=now?byType.get(s.type)||[]:[];
   return {session:s,phase:records.length?'FINISHED':start(s)>now?'UPCOMING':'WAITING',classification:records.length?'confirmed':'unavailable',
    reason:records.length?'已收录该节次成绩；尚未核验官方最终分类':start(s)>now?'按已公布赛程等待开始；时间调整以官方更新为准':'等待赛事正式开始或状态确认；无法从计划时间推断完赛'};
  });
  const selected=states.find(s=>s.session.id===session?.id),results=selected?.classification==='confirmed'?(byType.get(session!.type)||[]):[];
  const nextMeeting=meetings.filter(m=>Date.parse(m.raceStartUTC)>Date.parse(meeting.raceStartUTC)).sort((a,b)=>Date.parse(a.raceStartUTC)-Date.parse(b.raceStartUTC))[0]||null;
  const afterSelection=sessions.find(s=>start(s)>now&&(!session||start(s)>start(session)))||null;
  return {version:'3.3.0',serverTime:new Date(now).toISOString(),season:query.season,meeting,session,nextSession:afterSelection||(nextMeeting?sortedSessions(nextMeeting).find(s=>start(s)>now)||null:null),nextMeeting,
   calendarUpdatedAt:calendar.fetchedAt||null,calendarSource:calendar.source,isStale:calendar.isStale,
   availability:{...LIVE_PUBLIC_POLICY,channels:PUBLIC_LIVE_CHANNELS.map(c=>({...c}))},sessions:states,snapshot:null,results,resultStatus:selected?.classification||'unavailable',
   resultSourceUrls:results.length?[`https://api.jolpi.ca/ergast/f1/${query.season}/${meeting.round}/${session?.type==='qualifying'?'qualifying':session?.type==='sprint'?'sprint':'results'}.json`]:[]};
 }
}
function defaultDependencies():Dependencies{
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 const redis=url&&token?new Redis({url,token}):null;
 const production=process.env.NODE_ENV==='production'||process.env.VERCEL_ENV==='production';
 const locks=new Map<string,number>();
 const leaseTokens=new Map<string,string>();
 return {now:Date.now,persistent:Boolean(redis&&getStorageInfo().persistent)||!production,cache:getCacheStore(),sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 coordinator:{acquire:async key=>{
  if(redis){const token=crypto.randomUUID();const acquired=await redis.set(key,token,{nx:true,ex:45})==='OK';if(acquired)leaseTokens.set(key,token);return acquired;}
  if(production)throw new Error('Shared coordination unavailable');
  const now=Date.now();for(const [key,expiry] of locks)if(expiry<=now)locks.delete(key);
  if(locks.has(key))return false;locks.set(key,now+10000);return true;
 },release:async key=>{
  if(redis){const token=leaseTokens.get(key);if(!token)return;leaseTokens.delete(key);await redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",[key],[token]);}
  else locks.delete(key);
 }},calendar:season=>defaultF1Service.getCalendarResult(season),race:(s,r)=>defaultF1Service.getRaceResult(s,r),qualifying:(s,r)=>defaultF1Service.getQualifyingResult(s,r),sprint:(s,r)=>defaultF1Service.getSprintResult(s,r)};
}
let singleton:LivePublicService|undefined;
export function getPublicLiveService(){return singleton||=new LivePublicService(defaultDependencies());}
