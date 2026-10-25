import test from 'node:test';
import assert from 'node:assert/strict';
import {RedisLiveStore, type LiveRedisClient} from '../lib/f1/live/shared-store';
import {emptySnapshot} from '../lib/f1/live/state';
import type {LivePermission} from '../lib/f1/live/types';
const start=Date.parse('2026-10-25T20:00:00Z');
function fixture(){
 let time=start;const values=new Map<string,{body:string;expires:number}>();let commands=0;
 const read=(key:string)=>{const value=values.get(key);if(value&&value.expires<=time){values.delete(key);return null;}return value?.body??null;};
 const redis={
  async get(key:string){commands++;return read(key);},
  async set(key:string,body:string,options:{nx?:boolean;px?:number}){commands++;if(options.nx&&read(key)!==null)return null;values.set(key,{body,expires:time+(options.px||99999999)});return 'OK';},
  async eval(script:string,keys:string[],args:(string|number)[]){
   commands++;if(read(keys[0])!==args[0])return 0;
   if(script.includes('live-renew-v1')){values.get(keys[0])!.expires=time+Number(args[1]);return 1;}
   if(script.includes('live-release-v1')){values.delete(keys[0]);return 1;}
   if(script.includes('live-save-v1')){
    const next=JSON.parse(String(args[1]));if(next.schema!==1||next.sessionKey!==args[2])return -1;
    const previous=read(keys[1]);if(previous){const envelope=JSON.parse(previous);if(envelope.sourceMs>Number(args[3])||envelope.sourceMs===Number(args[3])&&envelope.receivedMs>Number(args[4]))return -2;}
    values.set(keys[1],{body:JSON.stringify({sourceMs:Number(args[3]),receivedMs:Number(args[4]),snapshot:next}),expires:time+Number(args[5])*1000});return 1;
   }
   throw Error('Unexpected Lua script');
  },
 };
 const permission:LivePermission={publicRedistribution:true,reference:'offline-test-grant',expiresAt:new Date(start+600000).toISOString(),topics:['TimingData']};
 const store=()=>new RedisLiveStore(redis as unknown as LiveRedisClient,{permission,now:()=>time,snapshotTtlSeconds:60});
 return {redis,store,permission,values,now:()=>time,advance:(ms:number)=>{time+=ms;},commands:()=>commands};
}
function snapshot(at=start){const s=emptySnapshot('test-only');s.sourceTimestamp=new Date(at).toISOString();s.receivedAt=s.sourceTimestamp;return s;}
test('Redis lease coordinates two instances and only current token can renew or release',async()=>{
 const f=fixture(),one=f.store(),two=f.store();assert.equal(await one.acquire('test-only','one',30000),true);assert.equal(await two.acquire('test-only','two',30000),false);
 assert.equal(await two.renew('test-only','two',30000),false);await two.release('test-only','two');assert.equal(await two.acquire('test-only','two',30000),false);
 f.advance(30001);assert.equal(await two.acquire('test-only','two',30000),true);assert.equal(await one.renew('test-only','one',30000),false);await one.release('test-only','one');assert.equal(await two.renew('test-only','two',30000),true);
});
test('atomic snapshot save rejects expired owners and older source timestamps; recovers exact snapshot',async()=>{
 const f=fixture(),one=f.store(),two=f.store();await one.acquire('test-only','one',30000);assert.equal(await one.saveSnapshot(snapshot(),'one'),true);assert.deepEqual(await two.loadSnapshot('test-only'),snapshot());
 f.advance(1000);assert.equal(await one.saveSnapshot(snapshot(start+1000),'one'),true);assert.equal(await one.saveSnapshot(snapshot(),'one'),false);
 f.advance(30000);await two.acquire('test-only','two',30000);assert.equal(await one.saveSnapshot(snapshot(f.now()),'one'),false);assert.equal(await two.saveSnapshot(snapshot(f.now()),'two'),true);
 assert.equal((await two.loadSnapshot('test-only'))?.sourceTimestamp,new Date(f.now()).toISOString());f.advance(60001);assert.equal(await two.loadSnapshot('test-only'),null);
});
test('permission, key, timestamps, size and strict schema fail closed before touching Redis',async()=>{
 const f=fixture(),blocked=new RedisLiveStore(f.redis as unknown as LiveRedisClient,{now:f.now});assert.equal(await blocked.acquire('test-only','one',30000),false);assert.equal(await blocked.loadSnapshot('test-only'),null);assert.equal(await blocked.saveSnapshot(snapshot(),'one'),false);assert.equal(f.commands(),0);
 const store=f.store();assert.equal(await store.acquire('../secrets','one',30000),false);assert.equal(await store.saveSnapshot({...snapshot(),source:'x'.repeat(200000)},'one'),false);assert.equal(await store.saveSnapshot({...snapshot(),schema:2} as any,'one'),false);assert.equal(await store.saveSnapshot(snapshot(start+60000),'one'),false);assert.equal(f.commands(),0);
 await store.acquire('test-only','one',30000);f.advance(600001);assert.equal(await store.loadSnapshot('test-only'),null);assert.equal(await store.saveSnapshot(snapshot(),'one'),false);
});
test('corrupt or cross-session persisted records are rejected and all keys have private namespace',async()=>{
 const f=fixture(),store=f.store();await store.acquire('test-only','one',30000);await store.saveSnapshot(snapshot(),'one');assert.ok([...f.values.keys()].every(key=>key.startsWith('apex:private:f1:live:v1:')));
 const key=[...f.values.keys()].find(key=>key.endsWith(':snapshot'))!;const value=f.values.get(key)!;const envelope=JSON.parse(value.body);envelope.snapshot.sessionKey='other';value.body=JSON.stringify(envelope);assert.equal(await store.loadSnapshot('test-only'),null);
 value.body='{broken';assert.equal(await store.loadSnapshot('test-only'),null);
});
