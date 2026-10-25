import {deepMerge} from './protocol';
import type {LiveConnection, LiveDriver, LiveEvent, LiveSnapshot, LiveTopic} from './types';
const record = (value: any): Record<string, any> => value && typeof value==='object' ? value : {};
const text = (value: any): string | null => typeof value==='string' && value.trim() ? value.slice(0,500) : null;
const number = (value: any): number | null => value!==null && value!=='' && value!==undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const boolean = (value: any): boolean | null => typeof value==='boolean'?value:null;
const value = (input: any) => text(input?.Value ?? input);
function last(input: any): any {return Object.entries(record(input)).sort(([a],[b])=>Number(a)-Number(b)).at(-1)?.[1];}
function fingerprint(input: string): string {let a=2166136261,b=5381;for(let i=0;i<input.length;i++){const n=input.charCodeAt(i);a=Math.imul(a^n,16777619);b=Math.imul(b,33)^n;}return `${a>>>0}:${b>>>0}`;}
const DRIVER_FIELDS: Partial<Record<LiveTopic,readonly string[]>> = {
 DriverList:['Tla','BroadcastName','FullName','FirstName','LastName','TeamName','TeamColour'],
 TimingData:['Position','LastLapTime','BestLapTime','NumberOfLaps','Sectors','GapToLeader','IntervalToPositionAhead','InPit','Retired','NumberOfPitStops'],
 TimingStats:['BestLapTime','BestSectors'],TimingAppData:['Stints','NumberOfPitStops'],
};
export function emptySnapshot(sessionKey: string, source = 'F1 Live Timing · permission required'): LiveSnapshot {
 return {schema:1,sessionKey,phase:'WAITING',connection:'UNAVAILABLE',source,sourceTimestamp:null,receivedAt:null,drivers:[],flag:null,messages:[],weather:null,currentLap:null,totalLaps:null,segment:null,remainingSeconds:null,classification:'unavailable',reason:null};
}
export function connectionAt(snapshot: LiveSnapshot, now = Date.now(), connected = true): LiveConnection {
 if(snapshot.phase==='FINISHED')return 'FINISHED';
 if(!connected)return snapshot.sourceTimestamp?'RECONNECTING':'UNAVAILABLE';
 const timestamp=Date.parse(snapshot.sourceTimestamp||'');
 if(!Number.isFinite(timestamp)||timestamp>now+5000)return 'UNAVAILABLE';
 return now-timestamp>15000?'DELAYED':'LIVE';
}
/** A bounded, per-session reducer. Scheduled start/end times are never lifecycle evidence. */
export class LiveState {
 private data: Partial<Record<LiveTopic, Record<string, any>>> = {};
 private timestamps=new Map<string,number>();
 private seen=new Set<string>();
 private current: LiveSnapshot;
 private connected=true;
 private lifecycleStatus='';
 private lifecycleTimestamp=-Infinity;
 constructor(readonly sessionKey: string, restored?: LiveSnapshot, source?: string) {
  this.current=restored?.schema===1&&restored.sessionKey===sessionKey?structuredClone(restored):emptySnapshot(sessionKey,source);
  if(restored?.schema===1&&restored.sessionKey===sessionKey){
   this.data.DriverList={};this.data.TimingData={Lines:{}};this.data.TimingAppData={Lines:{}};
   for(const d of restored.drivers.slice(0,64)){
    this.data.DriverList[d.number]={Tla:d.code,FullName:d.name,TeamName:d.team,TeamColour:d.teamColour?.replace(/^#/,'')};
    this.data.TimingData.Lines[d.number]={Position:d.position,LastLapTime:{Value:d.lastLap},BestLapTime:{Value:d.bestLap},Sectors:d.sectors.slice(0,3).map(Value=>({Value})),NumberOfLaps:d.completedLaps,GapToLeader:d.gapLeader,IntervalToPositionAhead:{Value:d.gapAhead},InPit:d.inPit,Retired:d.retired};
    this.data.TimingAppData.Lines[d.number]={Stints:[{Compound:d.compound,TotalLaps:d.tyreAge}],NumberOfPitStops:d.pitCount};
    for(const topic of ['DriverList','TimingData','TimingStats','TimingAppData'] as const){const stamp=Date.parse(d.sourceTimestamps?.[topic]||d.updatedAt||'');if(Number.isFinite(stamp))this.timestamps.set(`${topic}:${d.number}`,stamp);}
   }
   this.data.SessionInfo={Type:restored.sessionType||'',Status:restored.lifecycleStatus??(restored.sessionFinalized?'Finalised':restored.phase==='FINISHED'?'Finished':restored.phase==='LIVE'?'Started':restored.phase==='SUSPENDED'?'Aborted':restored.phase==='DELAYED'?'Delayed':restored.phase==='CANCELLED'?'Cancelled':'')};
   this.lifecycleStatus=String(this.data.SessionInfo.Status).toLowerCase();
   const lifecycle=Date.parse(restored.lifecycleTimestamp||'');
   this.lifecycleTimestamp=Number.isFinite(lifecycle)?lifecycle:-Infinity;
   for(const [topic,stamp] of Object.entries(restored.topicTimestamps||{})){const at=Date.parse(stamp||'');if(Number.isFinite(at))this.timestamps.set(topic,at);}
   if(restored.weather)this.data.WeatherData={AirTemp:restored.weather.airTemperature,TrackTemp:restored.weather.trackTemperature,Rainfall:restored.weather.rainfall};
   this.data.LapCount={CurrentLap:restored.currentLap,TotalLaps:restored.totalLaps};
  }
 }
 get retainedEntries(){return this.seen.size;}
 setConnected(connected: boolean){this.connected=connected;}
 snapshot(now = Date.now()): LiveSnapshot {return structuredClone({...this.current,connection:connectionAt(this.current,now,this.connected)});}
 apply(event: LiveEvent, now = Date.now()): boolean {
  if(event.sessionKey!==this.sessionKey)return false;
  const seriesTimestamp=event.topic==='SessionData'&&event.initial?last(event.payload?.StatusSeries)?.Utc:null;
  const at=event.timestamp===null?(seriesTimestamp?Date.parse(seriesTimestamp):null):Date.parse(event.timestamp);
  if(at!==null&&(!Number.isFinite(at)||at>now+5000||(!event.initial&&at<now-120000)))return false;
  if(at===null&&!event.initial)return false;
  if(!event.payload||typeof event.payload!=='object')return false;
  if(event.topic==='SessionInfo'&&event.payload.Key!==undefined&&String(event.payload.Key)!==this.sessionKey)return false;
  const id=`${event.topic}:${event.timestamp}:${fingerprint(event.id||JSON.stringify(event.payload))}`;
  if(this.seen.has(id))return false;
  const patch=record(event.payload);
  const driverTopic=['DriverList','TimingData','TimingStats','TimingAppData'].includes(event.topic);
  let accepted=false;
  if(driverTopic){
   const lines=event.topic==='DriverList'?patch:record(patch.Lines);
   const filtered: Record<string,unknown>={};
   for(const [driver,row] of Object.entries(lines).slice(0,64)){
    if(!/^\d{1,3}$/.test(driver))continue;
    const key=`${event.topic}:${driver}`,previous=this.timestamps.get(key);
    if(previous!==undefined&&(at===null||at<previous))continue;
    if(at!==null)this.timestamps.set(key,at);
    const allowed=DRIVER_FIELDS[event.topic]||[];filtered[driver]=Object.fromEntries(Object.entries(record(row)).filter(([field])=>allowed.includes(field)));accepted=true;
   }
   if(accepted)this.data[event.topic]=deepMerge(this.data[event.topic],event.topic==='DriverList'?filtered:{Lines:filtered}) as Record<string,any>;
  }else{
   const previous=this.timestamps.get(event.topic);
   if(previous!==undefined&&(at===null||at<previous))return false;
   if(at!==null){this.timestamps.set(event.topic,at);this.current.topicTimestamps={...this.current.topicTimestamps,[event.topic]:new Date(at).toISOString()};}
   this.data[event.topic]=deepMerge(this.data[event.topic],patch) as Record<string,any>;accepted=true;
  }
  if(!accepted)return false;
  this.seen.add(id);if(this.seen.size>1024)this.seen.delete(this.seen.values().next().value!);
  if(at!==null&&at>=Date.parse(this.current.sourceTimestamp||'1970-01-01'))this.current.sourceTimestamp=new Date(at).toISOString();
  this.current.receivedAt=new Date(now).toISOString();
  this.project(event,now);
  return true;
 }
 private project(event: LiveEvent, now: number){
  const info=record(this.data.SessionInfo),sessions=record(this.data.SessionData),incoming=record(event.payload);
  const infoStatus=typeof incoming.SessionStatus==='string'?incoming.SessionStatus:record(incoming.SessionStatus).Status||incoming.Status;
  const series=last(incoming.StatusSeries),seriesStatus=series?.SessionStatus||series?.Status;
  const incomingStatus=event.topic==='SessionInfo'?infoStatus:event.topic==='SessionData'?seriesStatus:null;
  const statusAt=event.timestamp?Date.parse(event.timestamp):Date.parse(series?.Utc||'');
  const statusAccepted=Boolean(incomingStatus)&&(Number.isFinite(statusAt)?statusAt>=this.lifecycleTimestamp&&statusAt<=now+5000:this.lifecycleTimestamp===-Infinity);
  if(statusAccepted){this.lifecycleStatus=String(incomingStatus).toLowerCase();this.current.lifecycleStatus=this.lifecycleStatus;if(Number.isFinite(statusAt)){this.lifecycleTimestamp=statusAt;this.current.lifecycleTimestamp=new Date(statusAt).toISOString();}}
  if(event.topic==='SessionInfo')this.current.sessionType=text(info.Type)||text(info.Name)||this.current.sessionType||null;
  const status=this.lifecycleStatus;
  if(event.topic==='SessionInfo'||event.topic==='SessionData'){
   // Finalised closes the timing session; it is not an FIA final-classification document.
   if(statusAccepted&&['finalised','finalized'].includes(status)){this.current.phase='FINISHED';this.current.sessionFinalized=true;if(this.current.classification!=='official')this.current.classification='provisional';}
   else if(statusAccepted&&['finished','ends','ended'].includes(status)){this.current.phase='FINISHED';this.current.classification='provisional';}
   else if(statusAccepted&&this.current.phase==='FINISHED'&&!this.current.sessionFinalized&&['started','resumed'].includes(status)&&(/qualif|shootout/i.test(String(info.Type||info.Name))||/^S?Q[123]$/.test(this.current.segment||''))){
    this.current.phase='LIVE';this.current.classification='unavailable';
   }
   else if(statusAccepted&&this.current.phase!=='FINISHED'){
    if(['started','resumed'].includes(status))this.current.phase='LIVE';
    else if(['aborted','suspended','stopped'].includes(status))this.current.phase='SUSPENDED';
    else if(status==='delayed')this.current.phase='DELAYED';
    else if(['cancelled','canceled'].includes(status))this.current.phase='CANCELLED';
   }
   const part=last(sessions.Series)?.QualifyingPart;
   if([1,2,3].includes(Number(part)))this.current.segment=`${/sprint|shootout/i.test(String(info.Type||info.Name))?'SQ':'Q'}${part}`;
  }
  if(event.topic==='TrackStatus'){
   const track=record(this.data.TrackStatus);const names:Record<string,string>={'1':'绿旗','2':'黄旗','4':'安全车','5':'红旗','6':'虚拟安全车','7':'虚拟安全车即将结束'};this.current.flag=text(track.Message)||names[String(track.Status)]||text(track.Status);
   if(this.current.phase!=='FINISHED'&&this.current.phase!=='CANCELLED'){
    if(String(track.Status)==='5')this.current.phase='SUSPENDED';
    else if(String(track.Status)==='1'&&this.current.phase==='SUSPENDED'&&['started','resumed'].includes(status))this.current.phase='LIVE';
   }
   this.current.reason=this.current.phase==='SUSPENDED'?this.current.flag:null;
  }
  if(event.topic==='LapCount'){this.current.currentLap=number(this.data.LapCount?.CurrentLap);this.current.totalLaps=number(this.data.LapCount?.TotalLaps);}
  if(event.topic==='WeatherData'){const w=record(this.data.WeatherData);this.current.weather={airTemperature:number(w.AirTemp),trackTemperature:number(w.TrackTemp),rainfall:w.Rainfall==='1'||w.Rainfall===1?true:w.Rainfall==='0'||w.Rainfall===0?false:boolean(w.Rainfall)};}
  if(event.topic==='RaceControlMessages'){
   const old=new Map(this.current.messages.map(message=>[message.id,message]));
   for(const [key,row] of Object.entries(record(event.payload.Messages))){const r=record(row),date=text(r.Utc),message=text(r.Message);if(!date||!Number.isFinite(Date.parse(date))||Date.parse(date)>now+5000||!message)continue;const id=`${date}:${key}:${message}`;old.set(id,{id,date,text:message});}
   this.current.messages=[...old.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(-100);
   this.data.RaceControlMessages={};
  }
  if(['DriverList','TimingData','TimingStats','TimingAppData'].includes(event.topic))this.projectDrivers();
 }
 private projectDrivers(){
  const roster=record(this.data.DriverList),timing=record(this.data.TimingData?.Lines),app=record(this.data.TimingAppData?.Lines),stats=record(this.data.TimingStats?.Lines);
  const previous=new Map(this.current.drivers.map(driver=>[driver.number,driver]));
  const ids=[...new Set([...Object.keys(roster),...Object.keys(timing),...Object.keys(app),...previous.keys()])].filter(id=>/^\d{1,3}$/.test(id)).slice(0,64);
  this.current.drivers=ids.map(id=>{
   const r=record(roster[id]),t=record(timing[id]),a=record(app[id]),s=record(stats[id]),stint=record(last(a.Stints));
   const sectors=[0,1,2].map(i=>record(record(t.Sectors)[i]));
   const stamps: LiveDriver['sourceTimestamps']={};
   for(const topic of ['DriverList','TimingData','TimingStats','TimingAppData'] as const){const date=this.timestamps.get(`${topic}:${id}`);stamps[topic]=date===undefined?null:new Date(date).toISOString();}
   const d: LiveDriver={number:id,code:text(r.Tla)||text(r.BroadcastName)||id,name:text(r.FullName)||[text(r.FirstName),text(r.LastName)].filter(Boolean).join(' ')||text(r.BroadcastName)||id,team:text(r.TeamName)||'暂不可用',teamColour:typeof r.TeamColour==='string'&&/^[a-f0-9]{6}$/i.test(r.TeamColour)?`#${r.TeamColour}`:null,position:number(t.Position),lastLap:value(t.LastLapTime),bestLap:value(t.BestLapTime)||value(s.BestLapTime),sectors:sectors.map(sector=>value(sector.Value)),completedLaps:number(t.NumberOfLaps),gapLeader:value(t.GapToLeader),gapAhead:value(t.IntervalToPositionAhead),compound:text(stint.Compound),tyreAge:number(stint.TotalLaps),pitCount:number(a.NumberOfPitStops??t.NumberOfPitStops),inPit:boolean(t.InPit),retired:boolean(t.Retired),updatedAt:stamps.TimingData||stamps.DriverList||null,sourceTimestamps:stamps,sectorPersonalBest:sectors.map(sector=>sector.PersonalFastest===true),sectorOverallBest:sectors.map(sector=>sector.OverallFastest===true)};
   return d;
  }).sort((a,b)=>(a.position??999)-(b.position??999)||Number(a.number)-Number(b.number));
 }
}
