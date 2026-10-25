// Synthetic offline fixtures only. These are never served by production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LivePublicService, LiveRequestError, parseLiveQuery} from '../lib/f1/live/service';
import type {F1Meeting} from '../lib/f1/types';
const now=Date.parse('2026-10-23T12:00:00Z');
const meeting={season:'2026',round:18,name:'Test Grand Prix',nameZh:'测试大奖赛',country:'Test',locality:'Test',circuitId:'test',circuitName:'Test',raceStartUTC:'2026-10-25T20:00:00Z',isSprintWeekend:false,sessions:[
{id:'fp1',name:'练习一',nameEn:'FP1',type:'practice',startTimeUTC:'2026-10-23T11:00:00Z',durationMinutes:60},
{id:'quali',name:'排位赛',nameEn:'Qualifying',type:'qualifying',startTimeUTC:'2026-10-24T20:00:00Z',durationMinutes:60},
{id:'race',name:'正赛',nameEn:'Race',type:'race',startTimeUTC:'2026-10-25T20:00:00Z',durationMinutes:120}]} as F1Meeting;
function harness(shared?:{values:Map<string,unknown>;locks:Set<string>}){
 const backing=shared||{values:new Map<string,unknown>(),locks:new Set<string>()};let calendarCalls=0,resultCalls=0;
 const deps:ConstructorParameters<typeof LivePublicService>[0]={now:()=>now,persistent:true,sleep:async()=>{},cache:{get:async<T>(key:string)=>backing.values.get(key) as T||null,set:async<T>(key:string,value:T)=>{backing.values.set(key,value);},delete:async(key:string)=>{backing.values.delete(key);}},
 coordinator:{acquire:async(key:string)=>{if(backing.locks.has(key))return false;backing.locks.add(key);return true;}},
 calendar:async()=>{calendarCalls++;return {data:[meeting],source:'cache' as const,fetchedAt:'2026-10-23T10:00:00Z',isStale:false};},
 race:async()=>{resultCalls++;return [];},qualifying:async()=>{resultCalls++;return [];},sprint:async()=>{resultCalls++;return [];}};
 return{deps,backing,service:new LivePublicService(deps),counts:()=>({calendarCalls,resultCalls})};
}
test('live query rejects unknown or malformed season, round and session',()=>{
 for(const query of ['season=bad','season=1949','round=0','round=1.5','round=99','session='+ 'a'.repeat(100),'session=../race'])assert.throws(()=>parseLiveQuery(new URLSearchParams(query),2026),LiveRequestError);
 assert.deepEqual(parseLiveQuery(new URLSearchParams('season=2026&round=18&session=fp1'),2026),{season:'2026',round:18,session:'fp1'});
});
test('elapsed schedule is WAITING, never fake LIVE or FINISHED; no private stream is exposed',async()=>{
 const {service}=harness();const data=await service.getSnapshot({season:'2026',round:18,session:'fp1'});
 assert.equal(data.sessions[0].phase,'WAITING');assert.equal(data.snapshot,null);assert.equal(data.availability.timingPublic,false);assert.equal(data.availability.channels.length,10);
 assert.equal(data.results.length,0);assert.equal(data.resultStatus,'unavailable');assert.ok(data.availability.officialUrl.startsWith('https://www.formula1.com/'));
 await assert.rejects(()=>service.getSnapshot({season:'2026',round:18,session:'not-real'}),e=>e instanceof LiveRequestError&&e.status===400);
});
test('future results cannot turn a scheduled session into FINISHED',async()=>{
 const h=harness();h.deps.qualifying=async()=>[{position:1,driverId:'test',driverName:'Test',constructorName:'Test',constructorId:'test',q1:'1:20.000'}];
 const data=await h.service.getSnapshot({season:'2026',round:18,session:'quali'});
 assert.equal(data.sessions.find(item=>item.session.id==='quali')?.phase,'UPCOMING');assert.deepEqual(data.results,[]);
});
test('confirmed race records are scoped and do not claim official final classification',async()=>{
 const h=harness();h.deps.now=()=>Date.parse('2026-10-25T22:30:00Z');h.deps.race=async()=>[{position:1,driverId:'test',driverName:'Test Driver',driverCode:'TST',constructorName:'Test Team',constructorId:'test',grid:1,laps:56,status:'Finished',points:25,time:'1:32:00'}];
 const data=await h.service.getSnapshot({season:'2026',round:18,session:'race'});
 assert.equal(data.sessions.find(item=>item.session.id==='race')?.phase,'FINISHED');assert.equal(data.resultStatus,'confirmed');assert.equal(data.results[0].laps,56);assert.match(data.resultSourceUrls[0],/2026\/18\/results/);
});
test('concurrent visitors share a bounded refresh, cache contains no private timing payload',async()=>{
 const h=harness();const responses=await Promise.all(Array.from({length:100},()=>h.service.getSnapshot({season:'2026',round:18,session:'fp1'})));
 assert.equal(h.counts().calendarCalls,1);assert.equal(responses.length,100);assert.ok(responses.every(data=>data.snapshot===null&&!data.availability.timingPublic));
 const second=new LivePublicService(h.deps);await second.getSnapshot({season:'2026',round:18,session:'fp1'});assert.equal(h.counts().calendarCalls,1);
});
test('production missing shared coordination fails closed, stale cache remains visibly stale',async()=>{
 const h=harness();h.deps.persistent=false;await assert.rejects(()=>h.service.getSnapshot({season:'2026'}),e=>e instanceof LiveRequestError&&e.status===503);assert.equal(h.counts().calendarCalls,0);
 const live=harness();const first=await live.service.getSnapshot({season:'2026',round:18});live.deps.now=()=>now+60000;live.deps.coordinator.acquire=async()=>{throw Error('offline');};
 const second=new LivePublicService(live.deps);const recovered=await second.getSnapshot({season:'2026',round:18});assert.equal(recovered.meeting?.round,first.meeting?.round);assert.equal(recovered.isStale,true);
});

test('HTTP routes share the same service, deny invalid queries, expose no write or grant switch',async t=>{
 const {NextRequest}=await import('next/server');const {GET}=await import('../app/api/f1/live/snapshot/route');const {GET:statusGET}=await import('../app/api/f1/live/status/route');const {getPublicLiveService}=await import('../lib/f1/live/service');
 const h=harness(),expected=await h.service.getSnapshot({season:'2026',round:18,session:'fp1'});let calls=0;
 t.mock.method(getPublicLiveService(),'getSnapshot',async()=>{calls++;return expected;});
 assert.equal((await GET(new NextRequest('https://f1.tike69.cc.cd/api/f1/live/snapshot?round=0'))).status,400);assert.equal(calls,0);
 for(const handler of [GET,statusGET]){const response=await handler(new NextRequest('https://f1.tike69.cc.cd/api/f1/live/snapshot?season=2026&round=18&session=fp1&timingPublic=true',{headers:{'x-live-grant':'true'}}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json();assert.equal(data.availability.timingPublic,false);assert.equal(data.snapshot,null);}
 assert.equal(calls,2);
 t.mock.method(getPublicLiveService(),'getSnapshot',async()=>{throw Error('internal credential details');});const failed=await GET(new NextRequest('https://f1.tike69.cc.cd/api/f1/live/snapshot'));assert.equal(failed.status,503);assert.equal(failed.headers.get('retry-after'),'10');assert.ok(!(await failed.text()).includes('credential'));
});

test('independent service instances honor one shared refresh lease',async()=>{
 const backing={values:new Map<string,unknown>(),locks:new Set<string>()};const first=harness(backing),second=harness(backing);
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let loads=0;
 first.deps.calendar=async()=>{loads++;await gate;return {data:[meeting],source:'cache',fetchedAt:'2026-10-23T10:00:00Z',isStale:false};};
 second.deps.calendar=async()=>{throw Error('second upstream connection forbidden');};second.deps.sleep=async()=>{await new Promise(resolve=>setTimeout(resolve,1));};
 const a=first.service.getSnapshot({season:'2026',round:18}),b=second.service.getSnapshot({season:'2026',round:18});
 await new Promise(resolve=>setTimeout(resolve,2));release();const values=await Promise.all([a,b]);assert.equal(loads,1);assert.equal(values[0].meeting?.round,values[1].meeting?.round);
});

test('legacy session aliases resolve only to actual sessions in the selected meeting',async()=>{
 const h=harness(),canonical=structuredClone(meeting);canonical.sessions.forEach(s=>s.id=`${s.id}-18`);canonical.sessions.push({id:'sprint-quali-18',name:'冲刺排位',nameEn:'Sprint Qualifying',type:'sprint_qualifying',startTimeUTC:'2026-10-23T15:00:00Z',durationMinutes:45});
 canonical.sessions.push({id:'practice-third-18',name:'练习三',nameEn:'Practice 3',type:'practice',startTimeUTC:'2026-10-24T11:00:00Z',durationMinutes:60});
 h.deps.calendar=async()=>({data:[canonical],source:'cache',fetchedAt:'2026-10-23T10:00:00Z',isStale:false});
 for(const [alias,id]of [['race','race-18'],['qualifying','quali-18'],['quali','quali-18'],['fp1','fp1-18'],['fp3','practice-third-18'],['sprint_qualifying','sprint-quali-18']])assert.equal((await h.service.getSnapshot({season:'2026',round:18,session:alias})).session?.id,id);
 for(const missing of ['fp2','sprint','race-19'])await assert.rejects(()=>h.service.getSnapshot({season:'2026',round:18,session:missing}),e=>e instanceof LiveRequestError&&e.status===400);
});
test('default meeting retains an unconfirmed race beyond its planned end rather than skipping to next round',async()=>{
 const h=harness(),next=structuredClone(meeting);next.round=19;next.raceStartUTC='2026-11-01T20:00:00Z';next.sessions=next.sessions.map(s=>({...s,startTimeUTC:new Date(Date.parse(s.startTimeUTC)+7*86400000).toISOString()}));
 h.deps.now=()=>Date.parse(meeting.raceStartUTC)+3*3600000;
 h.deps.calendar=async()=>({data:[meeting,next],source:'cache',fetchedAt:'2026-10-25T23:00:00Z',isStale:false});
 const data=await h.service.getSnapshot({season:'2026'});assert.equal(data.meeting?.round,18);assert.equal(data.session?.type,'race');assert.equal(data.sessions.find(item=>item.session.type==='race')?.phase,'WAITING');assert.equal(data.resultStatus,'unavailable');
});
