import test from 'node:test';
import assert from 'node:assert/strict';
import {SignalRFrames, deepMerge, subscriptionFrame} from '../lib/f1/live/protocol';
import {LiveState, emptySnapshot, connectionAt} from '../lib/f1/live/state';
import {LiveCollector, reconnectDelay} from '../lib/f1/live/collector';
import type {LiveEvent, LiveTopic} from '../lib/f1/live/types';
const now = Date.parse('2026-10-25T20:00:00Z');
function event(topic: LiveTopic, payload: Record<string, unknown>, offset = 0): LiveEvent {return {topic,payload,sessionKey:'test-only',timestamp:new Date(now+offset).toISOString(),receivedAt:new Date(now+offset).toISOString()};}
test('SignalR split RS frames, snapshot completion, whitelist and safe incremental merge',()=>{
 const frames=new SignalRFrames('test-only');
 assert.equal(frames.push('{"type":1,"target":"feed","arguments":["TimingData",{"Lines":{"44":{"Position":"1"}}},"2026-10-25T20:00:00Z"]}',now).events.length,0);
 const batch=frames.push('\u001e{"type":6}\u001e',now);assert.equal(batch.events.length,1);assert.equal(batch.heartbeat,true);
 assert.equal(frames.push('{"type":1,"target":"feed","arguments":["CarData.z",{},"2026-10-25T20:00:00Z"]}\u001e',now).events.length,0);
 assert.throws(()=>subscriptionFrame(['Position.z'] as any),/not permitted/);
 assert.deepEqual(deepMerge({Sectors:[{Value:'1'},{Value:'2'}]},{Sectors:{'1':{Value:'3'}}}),{Sectors:[{Value:'1'},{Value:'3'}]});
 assert.equal((deepMerge({},JSON.parse('{"__proto__":{"polluted":true}}')) as any).polluted,undefined);
 assert.equal(frames.push('{"type":3,"result":{"DriverList":{"44":{"Tla":"HAM"}}}}\u001e',now).events[0].timestamp,null);
});
test('session states require explicit evidence; red flag pauses, resume and finality differ',()=>{
 const state=new LiveState('test-only');assert.equal(state.snapshot().phase,'WAITING');
 assert.equal(connectionAt(state.snapshot(),now+999999),'UNAVAILABLE');
 state.apply(event('SessionInfo',{Status:'Started',Type:'Race'}),now);assert.equal(state.snapshot().phase,'LIVE');
 state.apply(event('TrackStatus',{Status:'5',Message:'Red Flag'},1),now+1);assert.equal(state.snapshot().phase,'SUSPENDED');
 state.apply(event('TrackStatus',{Status:'1',Message:'AllClear'},2),now+2);assert.equal(state.snapshot().phase,'LIVE');
 state.apply(event('SessionInfo',{Status:'Finished'},3),now+3);assert.equal(state.snapshot().phase,'FINISHED');assert.equal(state.snapshot().classification,'provisional');
 state.apply(event('SessionInfo',{Status:'Finalised'},4),now+4);assert.equal(state.snapshot().classification,'provisional','timing finalisation does not certify official FIA results');
 state.apply(event('TrackStatus',{Status:'1'},5),now+5);assert.equal(state.snapshot().phase,'FINISHED');
 for(const status of ['Started',{Status:'Started'}]){const s=new LiveState('test-only');s.apply(event('SessionInfo',{SessionStatus:status}),now);assert.equal(s.snapshot().phase,'LIVE');s.apply(event('SessionData',{StatusSeries:{'0':{Utc:new Date(now+1).toISOString(),SessionStatus:'Finished'}}},1),now+1);assert.equal(s.snapshot().phase,'FINISHED');}
 const wrong=new LiveState('11393');assert.equal(wrong.apply({...event('SessionInfo',{Key:11392,SessionStatus:'Started'}),sessionKey:'11393'},now),false);
});
test('practice/qualifying/sprint qualifying/sprint/race phases and numeric fields stay factual',()=>{
 for(const type of ['Practice','Qualifying','Sprint Shootout','Sprint','Race']){const s=new LiveState('test-only');s.apply(event('SessionInfo',{Type:type,Status:'Started'}),now);assert.equal(s.snapshot().phase,'LIVE');}
 const s=new LiveState('test-only');s.apply(event('DriverList',{'44':{Tla:'HAM',FullName:'Test driver',TeamName:'Test team',TeamColour:'FF0000'}}),now);
 s.apply(event('TimingData',{Lines:{'44':{Position:'2',LastLapTime:{Value:'1:20.000'},BestLapTime:{Value:'1:19.000'},NumberOfLaps:12,Sectors:{'0':{Value:'25.000',PersonalFastest:true}},GapToLeader:'+1.2',IntervalToPositionAhead:{Value:'+0.3'},InPit:false}}}),now);
 const d=s.snapshot().drivers[0];assert.equal(d.position,2);assert.equal(d.bestLap,'1:19.000');assert.deepEqual(d.sectors,['25.000',null,null]);assert.equal(d.compound,null);assert.equal(d.retired,null);
 s.apply(event('TimingAppData',{Lines:{'44':{Stints:{'0':{Compound:'SOFT',TotalLaps:4}},NumberOfPitStops:1}}},1),now+1);assert.equal(s.snapshot().drivers[0].tyreAge,4);
 s.apply(event('SessionData',{Series:{'0':{QualifyingPart:2}}},2),now+2);assert.equal(s.snapshot().segment,'Q2');
 s.apply(event('LapCount',{CurrentLap:13,TotalLaps:56},3),now+3);assert.equal(s.snapshot().totalLaps,56);
});
test('Q and SQ segment finishes can resume on newer start but finalised sessions and races stay terminal',()=>{
 for(const type of ['Qualifying','Sprint Shootout']){
  const state=new LiveState('test-only');state.apply(event('SessionInfo',{Type:type,SessionStatus:'Started'}),now);
  for(let part=1;part<=3;part++){
   const at=part*10;state.apply(event('SessionData',{Series:{[part]:{QualifyingPart:part}},StatusSeries:{[at]:{SessionStatus:'Started'}}},at),now+at);assert.equal(state.snapshot(now+at).phase,'LIVE');assert.equal(state.snapshot().segment,`${type==='Qualifying'?'Q':'SQ'}${part}`);
   state.apply(event('SessionData',{StatusSeries:{[at+1]:{SessionStatus:'Finished'}}},at+1),now+at+1);assert.equal(state.snapshot().phase,'FINISHED');
   state.apply(event('SessionInfo',{SessionStatus:'Started'},at-1),now+at+1);assert.equal(state.snapshot().phase,'FINISHED','older start from another status topic must not regress phase');
  }
  state.apply(event('SessionInfo',{SessionStatus:'Finalised'},40),now+40);assert.equal(state.snapshot().sessionFinalized,true);
  const restored=new LiveState('test-only',state.snapshot(now+40));restored.apply(event('SessionData',{StatusSeries:{'41':{SessionStatus:'Started'}}},41),now+41);assert.equal(restored.snapshot().phase,'FINISHED');
 }
 const race=new LiveState('test-only');race.apply(event('SessionInfo',{Type:'Race',SessionStatus:'Started'}),now);race.apply(event('SessionInfo',{SessionStatus:'Finished'},1),now+1);race.apply(event('SessionInfo',{SessionStatus:'Started'},2),now+2);assert.equal(race.snapshot().phase,'FINISHED');
});
test('dedupe, topic ordering, invalid/future/old events, timestamp omissions and bounded state',()=>{
 const s=new LiveState('test-only');assert.equal(s.apply(event('TimingData',{Lines:{'44':{Position:'1'}}}),now),true);
 assert.equal(s.apply(event('TimingData',{Lines:{'44':{Position:'1'}}}),now),false);
 assert.equal(s.apply(event('TimingData',{Lines:{'44':{Position:'2'}}},-1),now),false);
 assert.equal(s.apply(event('TimingData',{Lines:{'44':{Position:'3'}}},60000),now),false);
 assert.equal(s.apply({...event('TimingData',{}),timestamp:'invalid'},now),false);
 assert.equal(s.apply({...event('TimingData',{}),sessionKey:'wrong'},now),false);
 assert.equal(connectionAt(s.snapshot(),now+20000),'DELAYED');
 for(let i=0;i<300;i++)s.apply(event('RaceControlMessages',{Messages:{[i]:{Utc:new Date(now+i).toISOString(),Message:'test-only '+i}}},i),now+i);
 assert.equal(s.snapshot().messages.length,100);assert.ok(s.retainedEntries<=1024);
 const copy=s.snapshot();copy.drivers.length=0;assert.equal(s.snapshot().drivers.length,1);
});
test('last trusted snapshot restores without relabelling stale values as LIVE',()=>{
 const old=emptySnapshot('test-only');old.phase='SUSPENDED';old.sourceTimestamp=new Date(now).toISOString();old.receivedAt=old.sourceTimestamp;
 const s=new LiveState('test-only',old);assert.equal(s.snapshot(now+60000).phase,'SUSPENDED');assert.equal(s.snapshot(now+60000).connection,'DELAYED');
 const saved=new LiveState('test-only');saved.apply(event('DriverList',{'44':{Tla:'HAM',FullName:'Test driver',TeamName:'Test team'}}),now);saved.apply(event('TimingData',{Lines:{'44':{Position:'1',LastLapTime:{Value:'1:20.000'}}}}),now);
 const restored=new LiveState('test-only',saved.snapshot(now));restored.apply(event('TimingData',{Lines:{'44':{Position:'2'}}},1),now+1);assert.equal(restored.snapshot().drivers[0].name,'Test driver');assert.equal(restored.snapshot().drivers[0].lastLap,'1:20.000');
});
test('collector is disabled without grant; lease shares one upstream and stop rejects callbacks',async()=>{
 let opened=0;let held=false;const socket={send(_value:string){},close(){},onopen:null as null|(()=>void),onmessage:null as null|((event:{data:string})=>void),onclose:null as null|(()=>void),onerror:null as null|(()=>void)};
 const lease={async acquire(){if(held)return false;held=true;return true;},async renew(){return true;},async release(){held=false;}};
 const options={sessionKey:'test-only',source:'offline-test',now:()=>now,connect:()=>{opened++;return socket;},lease,onSnapshot:async()=>{},loadSnapshot:async()=>null};
 const blocked=new LiveCollector(options);assert.equal(await blocked.start(),false);assert.equal(opened,0);
 const grant={publicRedistribution:true,reference:'offline-test-only',expiresAt:new Date(now+60000).toISOString(),topics:['SessionInfo','TimingData'] as LiveTopic[]};
 const one=new LiveCollector({...options,permission:grant}),two=new LiveCollector({...options,permission:grant});assert.equal(await one.start(),true);assert.equal(await two.start(),false);assert.equal(opened,1);
 const callback=socket.onmessage;await one.stop();callback?.({data:'{"type":1,"target":"feed","arguments":["TimingData",{},"2026-10-25T20:00:00Z"]}\u001e'});assert.equal(one.snapshot().sourceTimestamp,null);
});
test('collector batches, restores on reconnect, times out, backs off and clears all timers',async()=>{
 let time=now,id=0,loads=0;const timers=new Map<number,{at:number;run:()=>void}>();
 const sockets:any[]=[];const saved:any[]=[];
 const advance=async(ms:number)=>{time+=ms;for(const [key,timer] of [...timers].sort((a,b)=>a[1].at-b[1].at)){if(timer.at<=time){timers.delete(key);timer.run();}}await Promise.resolve();await Promise.resolve();};
 const collector=new LiveCollector({sessionKey:'test-only',source:'offline-fixture',permission:{publicRedistribution:true,reference:'offline-tests-only',expiresAt:new Date(now+600000).toISOString(),topics:['SessionInfo','TimingData']},now:()=>time,random:()=>0,
  schedule:(run,delay)=>{const key=++id;timers.set(key,{at:time+delay,run});return key as unknown as ReturnType<typeof setTimeout>;},cancel:timer=>{timers.delete(timer as unknown as number);},
  lease:{acquire:async()=>true,renew:async()=>true,release:async()=>{}},loadSnapshot:async()=>{loads++;return null;},onSnapshot:async snapshot=>{saved.push(snapshot);},
  connect:()=>{const socket={send:(value:string)=>{socket.sent.push(value);},sent:[] as string[],close(){},onopen:null,onmessage:null,onclose:null,onerror:null};sockets.push(socket);return socket;},
 });
 assert.equal(await collector.start(),true);sockets[0].onopen();assert.match(sockets[0].sent[0],/protocol/);sockets[0].onmessage({data:'{}\u001e'});assert.match(sockets[0].sent[1],/Subscribe/);
 sockets[0].onmessage({data:JSON.stringify({type:3,result:{SessionInfo:{Key:'test-only',SessionStatus:'Started'}}})+'\u001e'});
 const feed=(position:number)=>JSON.stringify({type:1,target:'feed',arguments:['TimingData',{Lines:{'44':{Position:String(position)}}},new Date(time).toISOString()]})+'\u001e';
 sockets[0].onmessage({data:feed(1)});sockets[0].onmessage({data:feed(2)});assert.equal(saved.length,0);await advance(200);assert.equal(saved.length,1);assert.equal(saved[0].drivers[0].position,2);
 sockets[0].onclose();assert.equal(collector.snapshot().connection,'RECONNECTING');await advance(750);assert.equal(sockets.length,2);assert.equal(loads,2);
 sockets[1].onopen();sockets[1].onmessage({data:'{}\u001e'});
 sockets[1].onmessage({data:feed(3)});assert.equal(collector.snapshot().drivers[0].position,2,'reconnected transport must validate source scope again');
 sockets[1].onmessage({data:JSON.stringify({type:3,result:{SessionInfo:{Key:'test-only'}}})+'\u001e'});
 sockets[1].onmessage({data:feed(3)});assert.equal(collector.snapshot().drivers[0].position,3);
 assert.equal(reconnectDelay(0,()=>0),750);assert.equal(reconnectDelay(2,()=>1),5000);assert.ok(reconnectDelay(999,()=>1)<=37500);
 await advance(31000);await collector.stop();assert.equal(timers.size,0);assert.equal(collector.snapshot().drivers[0].position,3);
});
test('sustained synthetic test event sequence has bounded retained memory structures',()=>{
 const state=new LiveState('test-only');
 for(let i=0;i<15000;i++)state.apply(event('TimingData',{Lines:{'44':{Position:String(i%20+1),LastLapTime:{Value:'1:20.000'}}}},i),now+i);
 assert.equal(state.retainedEntries,1024);assert.equal(state.snapshot(now+15000).drivers.length,1);assert.ok(JSON.stringify(state.snapshot()).length<10000);
});
test('protocol pings require an active grant and completed handshake; send failure reconnects and stop cancels pings',async()=>{
 let time=now,id=0,closed=0,throwPing=false;const timers=new Map<number,{at:number;run:()=>void}>(),sent:string[]=[];
 const socket={send:(value:string)=>{if(throwPing&&value.includes('"type":6'))throw Error('offline-test disconnect');sent.push(value);},close:()=>{closed++;},onopen:null as null|(()=>void),onmessage:null as null|((event:{data:string})=>void),onclose:null as null|(()=>void),onerror:null as null|(()=>void)};
 const advance=async(ms:number)=>{time+=ms;for(const[key,timer]of[...timers])if(timer.at<=time){timers.delete(key);timer.run();}await Promise.resolve();await Promise.resolve();};
 const collector=new LiveCollector({sessionKey:'test-only',source:'offline-test',permission:{publicRedistribution:true,reference:'offline-test-only',expiresAt:new Date(now+600000).toISOString(),topics:['SessionInfo','TimingData']},now:()=>time,random:()=>0,
  schedule:(run,delay)=>{const key=++id;timers.set(key,{at:time+delay,run});return key as unknown as ReturnType<typeof setTimeout>;},cancel:timer=>{timers.delete(timer as unknown as number);},connect:()=>socket,
  lease:{acquire:async()=>true,renew:async()=>true,release:async()=>{}},loadSnapshot:async()=>null,onSnapshot:async()=>{},
 });
 await collector.start();socket.onopen?.();await advance(10000);assert.equal(sent.filter(frame=>frame==='{"type":6}\u001e').length,0,'no ping before handshake');
 socket.onmessage?.({data:'{}\u001e'});await advance(10000);assert.equal(sent.filter(frame=>frame==='{"type":6}\u001e').length,1);
 throwPing=true;await advance(10000);assert.equal(closed,1,'failed ping closes transport and schedules reconnect');
 await collector.stop();const sentAtStop=sent.length;await advance(100000);assert.equal(sent.length,sentAtStop);assert.equal(timers.size,0);
});
