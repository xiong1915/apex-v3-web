import {hasLivePermission} from './collector';
import {connectionAt} from './state';
import type {LivePermission,LiveSnapshot} from './types';
export interface ApprovedLiveSource {
 id:string;source:string;season:string;round:number;sessionId:string;sessionKey:string;
 notBefore:string;stopAfter:string;permission:LivePermission;
}
/** Code-reviewed grants only. Never populate from env, requests, Redis or UI toggles.
 * Each entry must reference actual display rights and an exact calendar/source mapping.
 * Empty until evidence is obtained; source access alone is not permission.
 */
export const APPROVED_LIVE_SOURCES:readonly ApprovedLiveSource[]=Object.freeze([]);
export function sourceActive(source:ApprovedLiveSource,now=Date.now()):boolean{
 return hasLivePermission(source.permission,now)&&source.permission.topics.includes('SessionInfo')&&
  Date.parse(source.notBefore)<=now&&Date.parse(source.stopAfter)>now;
}
export function approvedLiveSource(query:{season:string;round?:number;session?:string},now=Date.now(),registry=APPROVED_LIVE_SOURCES){
 return registry.find(source=>source.season===query.season&&source.round===query.round&&source.sessionId===query.session&&sourceActive(source,now))||null;
}
export function projectPublicSnapshot(snapshot:LiveSnapshot,source:ApprovedLiveSource,now=Date.now()):LiveSnapshot|null{
 if(!sourceActive(source,now)||snapshot.schema!==1||snapshot.sessionKey!==source.sessionKey)return null;
 const permitted=(topic:string)=>source.permission.topics.some(t=>t===topic);
 const {lifecycleTimestamp,lifecycleStatus,sessionType,topicTimestamps,...visible}=snapshot;
 const stamps=[...Object.entries(topicTimestamps||{}),...snapshot.drivers.flatMap(driver=>Object.entries(driver.sourceTimestamps||{}))].filter(([topic])=>permitted(topic)).map(([,at])=>Date.parse(at||'')).filter(at=>Number.isFinite(at)&&at<=now+5000);
 // Weather/roster updates must not make an old timing table appear LIVE.
 const timingStamps=snapshot.drivers.map(driver=>Date.parse(driver.sourceTimestamps?.TimingData||'')).filter(at=>Number.isFinite(at)&&at<=now+5000);
 const freshness=permitted('TimingData')&&snapshot.drivers.length?timingStamps:stamps;
 const sourceTimestamp=freshness.length?new Date(Math.max(...freshness)).toISOString():null;
 const lifecyclePermitted=permitted('SessionInfo')&&permitted('SessionData')&&permitted('TrackStatus');
 const publicState={...snapshot,phase:lifecyclePermitted?snapshot.phase:'WAITING' as const,sourceTimestamp};
 return {...visible,phase:publicState.phase,classification:lifecyclePermitted&&snapshot.phase==='FINISHED'?'provisional':'unavailable',sessionFinalized:lifecyclePermitted?snapshot.sessionFinalized:undefined,source:source.source,sourceTimestamp,connection:connectionAt(publicState,now,snapshot.connection!=='RECONNECTING'&&snapshot.connection!=='UNAVAILABLE'),
  currentLap:permitted('LapCount')?snapshot.currentLap:null,totalLaps:permitted('LapCount')?snapshot.totalLaps:null,
  weather:permitted('WeatherData')?snapshot.weather:null,flag:permitted('TrackStatus')?snapshot.flag:null,
  reason:permitted('TrackStatus')?snapshot.reason:null,messages:permitted('RaceControlMessages')?snapshot.messages:[],
  segment:permitted('SessionData')?snapshot.segment:null,remainingSeconds:permitted('SessionData')?snapshot.remainingSeconds:null,
  drivers:(!permitted('DriverList')&&!permitted('TimingData'))?[]:snapshot.drivers.map(driver=>({...driver,sourceTimestamps:undefined,
   code:permitted('DriverList')?driver.code:driver.number,name:permitted('DriverList')?driver.name:driver.number,
   team:permitted('DriverList')?driver.team:'暂不可用',teamColour:permitted('DriverList')?driver.teamColour:null,
   position:permitted('TimingData')?driver.position:null,lastLap:permitted('TimingData')?driver.lastLap:null,
   bestLap:permitted('TimingData')&&permitted('TimingStats')?driver.bestLap:null,sectors:permitted('TimingData')?driver.sectors:[null,null,null],
   sectorPersonalBest:permitted('TimingData')?driver.sectorPersonalBest:[],sectorOverallBest:permitted('TimingData')?driver.sectorOverallBest:[],
   completedLaps:permitted('TimingData')?driver.completedLaps:null,gapLeader:permitted('TimingData')?driver.gapLeader:null,gapAhead:permitted('TimingData')?driver.gapAhead:null,
   inPit:permitted('TimingData')?driver.inPit:null,retired:permitted('TimingData')?driver.retired:null,
   compound:permitted('TimingAppData')?driver.compound:null,tyreAge:permitted('TimingAppData')?driver.tyreAge:null,pitCount:permitted('TimingAppData')&&permitted('TimingData')?driver.pitCount:null,
  }))};
}
