import type {LiveConnection, LiveDriver, LivePhase} from '@/lib/f1/live/types';

export function phaseForDisplay(phase: LivePhase, starts: string, now: number): LivePhase {
 if (phase !== 'UPCOMING') return phase;
 const start=Date.parse(starts);
 return !Number.isFinite(start)||now>=start ? 'WAITING' : 'UPCOMING';
}
export function countdownParts(starts: string, now: number): [number,number,number,number] | null {
 const start=Date.parse(starts); if(!Number.isFinite(start)||!Number.isFinite(now))return null;
 const seconds=Math.max(0,Math.ceil((start-now)/1000));
 return [Math.floor(seconds/86400),Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60];
}
export function connectionForDisplay(connection: LiveConnection, sourceTime:string|null, now:number, failed:boolean): LiveConnection {
 if(connection==='FINISHED')return connection;
 if(failed)return 'RECONNECTING';
 if(connection!=='LIVE')return connection;
 if(!sourceTime)return 'UNAVAILABLE';
 const timestamp=Date.parse(sourceTime);
 if(!Number.isFinite(timestamp))return 'UNAVAILABLE';
 return now-timestamp>15000||timestamp-now>5000?'DELAYED':'LIVE';
}
export function retryDelay(attempt: number, random= Math.random) {return Math.min(60000,Math.round(Math.min(60000,2000*2**Math.min(attempt,10))*(0.75+random()*0.5)));}
function lapMilliseconds(value:string|null) {
 if(!value)return Infinity;const chunks=value.split(':').map(Number);
 if(chunks.some(chunk=>!Number.isFinite(chunk)))return Infinity;
 return chunks.length===2?chunks[0]*60000+chunks[1]*1000:chunks.length===1?chunks[0]*1000:Infinity;
}
export function sortLiveDrivers(rows:LiveDriver[], mode:string):LiveDriver[]{
 return rows.map((driver,index)=>({driver,index})).sort((a,b)=>{
  const av=mode==='best'?lapMilliseconds(a.driver.bestLap):a.driver.position??Infinity;
  const bv=mode==='best'?lapMilliseconds(b.driver.bestLap):b.driver.position??Infinity;
  return (av===bv?0:av-bv)||a.index-b.index;
 }).map(item=>item.driver);
}
