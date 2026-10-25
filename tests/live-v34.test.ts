import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveState,emptySnapshot} from '../lib/f1/live/state';
import {LiveCollector} from '../lib/f1/live/collector';
import {LIVE_PUBLIC_POLICY} from '../lib/f1/live/policy';
const now=Date.parse('2026-10-25T20:20:00Z');
const event=(topic:any,payload:any,at=now)=>({topic,payload,sessionKey:'11396',timestamp:new Date(at).toISOString(),receivedAt:new Date(at).toISOString()});
test('initial lifecycle can predate subscription but cannot overwrite newer restored completion',()=>{
 const initial={...event('SessionData',{StatusSeries:{'0':{Utc:new Date(now-600000).toISOString(),SessionStatus:'Started'}}}),timestamp:null,initial:true};
 const state=new LiveState('11396');assert.equal(state.apply(initial,now),true);assert.equal(state.snapshot(now).phase,'LIVE');
 state.apply(event('SessionData',{StatusSeries:{'1':{SessionStatus:'Finished'}}},now-1),now);
 const restored=new LiveState('11396',state.snapshot(now));assert.equal(restored.apply(initial,now),false);assert.equal(restored.snapshot(now).phase,'FINISHED');
});
test('official timing link targets the verified active timing route',()=>assert.equal(LIVE_PUBLIC_POLICY.officialUrl,'https://www.formula1.com/en/timing/f1-live'));
test('restoring weather freshness does not advance lifecycle ordering',()=>{
 const previous=emptySnapshot('11396');previous.phase='LIVE';previous.sourceTimestamp=new Date(now).toISOString();
 const state=new LiveState('11396',previous);
 state.apply({...event('SessionData',{StatusSeries:{'0':{Utc:new Date(now-1000).toISOString(),SessionStatus:'Finished'}}}),timestamp:null,initial:true},now);
 assert.equal(state.snapshot(now).phase,'FINISHED');
});
test('qualifying session kind and lifecycle timestamp survive recovery before Q1 metadata',()=>{
 const state=new LiveState('11396');state.apply(event('SessionInfo',{Type:'Qualifying',SessionStatus:'Started'},now-3000),now);
 state.apply(event('SessionData',{StatusSeries:{'0':{SessionStatus:'Finished'}}},now-2000),now);
 state.apply(event('WeatherData',{AirTemp:'25'},now),now);
 const restored=new LiveState('11396',state.snapshot(now));restored.apply(event('SessionData',{StatusSeries:{'1':{SessionStatus:'Started'}}},now+1),now+1);
 assert.equal(restored.snapshot(now+1).phase,'LIVE');
});
test('collector rejects a foreign SessionInfo and all timing in the same batch, even when timing comes first',async()=>{
 let released=false;const socket:any={send(){},close(){},onopen:null,onmessage:null,onclose:null,onerror:null};
 const collector=new LiveCollector({sessionKey:'11396',source:'offline-only',now:()=>now,permission:{publicRedistribution:true,reference:'offline-only',expiresAt:new Date(now+60000).toISOString(),topics:['SessionInfo','TimingData']},connect:()=>socket,lease:{acquire:async()=>true,renew:async()=>true,release:async()=>{released=true;}},loadSnapshot:async()=>null,onSnapshot:async()=>{}});
 try{await collector.start();socket.onopen();socket.onmessage({data:'{}\u001e'});
 socket.onmessage({data:JSON.stringify({type:3,result:{TimingData:{Lines:{'44':{Position:'1',LastLapTime:{Value:'1:00.000'}}}},SessionInfo:{Key:999,SessionStatus:'Started'}}})+'\u001e'});
 assert.equal(collector.snapshot().drivers.length,0);await Promise.resolve();assert.equal(released,true);
 }finally{await collector.stop();}
});
test('a red-flag snapshot retains the real lifecycle for green-flag recovery',()=>{
 const state=new LiveState('11396');state.apply(event('SessionInfo',{Type:'Race',SessionStatus:'Started'},now-2),now);
 state.apply(event('TrackStatus',{Status:'5'},now-1),now);
 const restored=new LiveState('11396',state.snapshot(now));restored.apply(event('TrackStatus',{Status:'1'},now),now);
 assert.equal(restored.snapshot(now).phase,'LIVE');
});
test('restored channel watermarks reject old laps, flags and weather while retaining partial weather fields',()=>{
 const state=new LiveState('11396');state.apply(event('WeatherData',{AirTemp:'30',TrackTemp:'40'},now),now);
 state.apply(event('LapCount',{CurrentLap:12,TotalLaps:56},now),now);state.apply(event('TrackStatus',{Status:'4'},now),now);
 const restored=new LiveState('11396',state.snapshot(now));
 assert.equal(restored.apply(event('WeatherData',{AirTemp:'10'},now-1),now),false);
 assert.equal(restored.apply(event('LapCount',{CurrentLap:1},now-1),now),false);
 assert.equal(restored.apply(event('TrackStatus',{Status:'1'},now-1),now),false);
 restored.apply(event('WeatherData',{Rainfall:'1'},now+1),now+1);
 assert.equal(restored.snapshot(now+1).weather?.airTemperature,30);
 assert.equal(restored.snapshot(now+1).currentLap,12);
});
