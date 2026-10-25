// Local contracts only. Fixture grants are never part of the deployed registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedLiveSource,projectPublicSnapshot,type ApprovedLiveSource} from '../lib/f1/live/sources';
import {emptySnapshot,LiveState} from '../lib/f1/live/state';
import {LIVE_TOPICS} from '../lib/f1/live/types';
import {connectSignalR} from '../lib/f1/live/transport';
import {PUBLIC_LIVE_CHANNELS} from '../lib/f1/live/policy';
import worker,{LiveCollectorHost} from '../workers/live-collector/worker';
import {LiveCollector} from '../lib/f1/live/collector';
const now=Date.parse('2026-10-25T20:45:00Z');
const source:ApprovedLiveSource={id:'fixture',season:'2026',round:18,sessionId:'race',sessionKey:'11396',source:'offline fixture',notBefore:new Date(now-1000).toISOString(),stopAfter:new Date(now+60000).toISOString(),permission:{reference:'offline fixture only',publicRedistribution:true,expiresAt:new Date(now+60000).toISOString(),topics:['SessionInfo','LapCount']}};
test('production grant registry stays closed; fixture scope and expiry are exact',()=>{
 assert.equal(approvedLiveSource({season:'2026',round:18,session:'race'},now),null);
 assert.equal(approvedLiveSource({season:'2026',round:18,session:'race'},now,[source]),source);
 assert.equal(approvedLiveSource({season:'2026',round:19,session:'race'},now,[source]),null);
 assert.equal(approvedLiveSource({season:'2026',round:18,session:'race'},now+60001,[source]),null);
});
test('projection strips unlicensed channels and internal metadata and enforces source key',()=>{
 const snapshot=emptySnapshot('11396');snapshot.currentLap=23;snapshot.phase='LIVE';snapshot.flag='secret';snapshot.lifecycleStatus='started';snapshot.messages=[{id:'x',date:new Date(now).toISOString(),text:'private'}];
 const projected=projectPublicSnapshot(snapshot,source,now)!;
 assert.equal(projected.currentLap,23);assert.equal(projected.flag,null);assert.deepEqual(projected.messages,[]);assert.equal(projected.lifecycleStatus,undefined);
 assert.equal(projected.phase,'WAITING');assert.equal(projected.classification,'unavailable');
 assert.equal(projectPublicSnapshot({...snapshot,sessionKey:'other'},source,now),null);
 assert.equal(projectPublicSnapshot(snapshot,source,now+60001),null);
});
test('transport completes Cloudflare upgrade, forwards frames and cancellation closes upstream',async()=>{
 const handlers:Record<string,(event:any)=>void>={};let accepted=0,closed=0;const sent:string[]=[];let calls=0;
 const upstream={accept(){accepted++;},close(){closed++;},send(value:string){sent.push(value);},addEventListener(name:string,handler:(event:any)=>void){handlers[name]=handler;}};
 const socket=connectSignalR(async()=>++calls===1?Response.json({connectionToken:'fixture'}):({status:101,webSocket:upstream} as any));
 await new Promise<void>(resolve=>{socket.onopen=()=>resolve();});
 assert.equal(accepted,1);socket.send('handshake');assert.deepEqual(sent,['handshake']);
 let received='';socket.onmessage=event=>{received=event.data;};handlers.message({data:'frame'});assert.equal(received,'frame');socket.close();assert.equal(closed,1);handlers.message({data:'late'});assert.equal(received,'frame');
});
test('channel capability matches recorded US race evidence independently of public permission',()=>{
 assert.equal(PUBLIC_LIVE_CHANNELS.find(c=>c.name==='LapCount')?.status,'incremental-observed');
 assert.equal(PUBLIC_LIVE_CHANNELS.find(c=>c.name==='TrackStatus')?.status,'snapshot-only');
});
test('fresh weather cannot relabel an old timing table as LIVE',()=>{
 const state=new LiveState('11396');
 state.apply({sessionKey:'11396',topic:'TimingData',payload:{Lines:{'12':{Position:'1'}}},timestamp:new Date(now-60000).toISOString(),receivedAt:new Date(now).toISOString()},now);
 state.apply({sessionKey:'11396',topic:'WeatherData',payload:{AirTemp:'25'},timestamp:new Date(now).toISOString(),receivedAt:new Date(now).toISOString()},now);
 const projected=projectPublicSnapshot(state.snapshot(now),{...source,permission:{...source.permission,topics:LIVE_TOPICS}},now)!;
 assert.equal(projected.connection,'DELAYED');assert.equal(projected.sourceTimestamp,new Date(now-60000).toISOString());
});
test('transport refuses non-upgrade response without leaking negotiate token',async()=>{
 let closed=false;const calls:string[]=[];
 const socket=connectSignalR(async(input,init)=>{calls.push(String(input));if(calls.length===1)return Response.json({connectionToken:'sensitive-test-token'});return new Response('',{status:403});});
 await new Promise<void>(resolve=>{socket.onerror=()=>{closed=true;resolve();};});
 assert.equal(closed,true);assert.equal(calls.length,2);socket.close();
});
test('durable host wakes from persisted source, rejects public controls and stops at permission expiry',async t=>{
 let clock=now,starts=0,stops=0,alarm:number|null=null;
 t.mock.method(Date,'now',()=>clock);
 const values=new Map<string,unknown>();const storage={get:async<T>(key:string)=>values.get(key) as T,put:async(key:string,v:unknown)=>{values.set(key,v);},setAlarm:async(at:number)=>{alarm=at;},deleteAlarm:async()=>{alarm=null;}};
 const ctx={storage,blockConcurrencyWhile:async<T>(fn:()=>Promise<T>)=>fn()};
 const env:any={UPSTASH_REDIS_REST_URL:'https://offline.invalid',UPSTASH_REDIS_REST_TOKEN:'offline-only'};
 const dependencies={sources:[source],createCollector:()=>({start:async()=>{starts++;return true;},stop:async()=>{stops++;}})};
 assert.equal(worker.fetch().status,404);
 const locked=new LiveCollectorHost(ctx,env);assert.equal((await locked.fetch(new Request('https://internal/start?source=fixture',{method:'POST'}))).status,403);
 const host=new LiveCollectorHost(ctx,env,dependencies);assert.equal((await host.fetch(new Request('https://internal/start?source=fixture',{method:'POST'}))).status,200);assert.equal(starts,1);assert.ok(alarm!>now);
 const restored=new LiveCollectorHost(ctx,env,dependencies);await restored.alarm();assert.equal(starts,2,'new runtime recovers source from durable storage');
 clock+=60001;await restored.alarm();assert.equal(stops,1);assert.equal(alarm,null);
 await host.alarm();assert.equal(stops,2);
});
test('a snapshot persistence failure closes upstream and releases shared ownership',async()=>{
 const pending=new Map<number,{run:()=>void;delay:number}>();let sequence=0,released=0,closed=0;
 const socket:any={send(){},close(){closed++;},onopen:null,onmessage:null,onclose:null,onerror:null};
 const collector=new LiveCollector({sessionKey:'11396',source:'offline-only',permission:source.permission,now:()=>now,connect:()=>socket,
  schedule:(run,delay)=>{const id=++sequence;pending.set(id,{run,delay});return id as any;},cancel:id=>{pending.delete(id as any);},
  lease:{acquire:async()=>true,renew:async()=>true,release:async()=>{released++;}},loadSnapshot:async()=>null,onSnapshot:async()=>{throw Error('offline storage failure');}});
 await collector.start();socket.onopen();socket.onmessage({data:'{}\u001e'});socket.onmessage({data:JSON.stringify({type:3,result:{SessionInfo:{Key:'11396'}}})+'\u001e'});
 const [handle,flush]=[...pending.entries()].find(([,item])=>item.delay===200)!;pending.delete(handle);flush.run();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(released,1);assert.equal(closed,1);assert.equal(pending.size,0);await collector.stop();
});
