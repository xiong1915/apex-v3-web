import type {Redis} from '@upstash/redis';
import {z} from 'zod';
import type {LiveLease} from './collector';
import {hasLivePermission} from './collector';
import {LIVE_TOPICS, type LivePermission, type LiveSnapshot} from './types';

export type LiveRedisClient = Pick<Redis, 'get' | 'set' | 'eval'>;
const PREFIX='apex:private:f1:live:v1:';
const MAX_BYTES=192_000;
const timestamp=z.string().datetime({offset:true}).nullable();
const nullableText=z.string().max(500).nullable();
const count=z.number().int().min(0).max(100000).nullable();
const driver=z.object({
 number:z.string().regex(/^\d{1,3}$/),code:z.string().max(100),name:z.string().max(500),team:z.string().max(500),teamColour:z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
 position:z.number().int().min(1).max(100).nullable(),lastLap:nullableText,bestLap:nullableText,sectors:z.array(nullableText).length(3),completedLaps:count,gapLeader:nullableText,gapAhead:nullableText,
 compound:nullableText,tyreAge:count,pitCount:count,inPit:z.boolean().nullable(),retired:z.boolean().nullable(),updatedAt:timestamp,
 sourceTimestamps:z.partialRecord(z.enum(LIVE_TOPICS),timestamp).optional(),sectorPersonalBest:z.array(z.boolean()).max(3).optional(),sectorOverallBest:z.array(z.boolean()).max(3).optional(),
}).strict();
const snapshotSchema=z.object({
 schema:z.literal(1),sessionKey:z.string().regex(/^[a-z0-9][a-z0-9_.:-]{0,159}$/i),
 phase:z.enum(['UPCOMING','WAITING','LIVE','SUSPENDED','FINISHED','DELAYED','CANCELLED']),connection:z.enum(['LIVE','DELAYED','RECONNECTING','UNAVAILABLE','FINISHED']),
 source:z.string().max(500),sourceTimestamp:timestamp,receivedAt:timestamp,drivers:z.array(driver).max(64),flag:nullableText,
 messages:z.array(z.object({id:z.string().max(1000),date:z.string().datetime({offset:true}),text:z.string().max(500)}).strict()).max(100),
 weather:z.object({airTemperature:z.number().finite().nullable(),trackTemperature:z.number().finite().nullable(),rainfall:z.boolean().nullable()}).strict().nullable(),
 currentLap:count,totalLaps:count,segment:nullableText,remainingSeconds:z.number().finite().min(0).max(86400).nullable(),classification:z.enum(['unavailable','provisional','official']),reason:nullableText,sessionFinalized:z.boolean().optional(),
}).strict();
export const LIVE_RENEW_SCRIPT=`-- live-renew-v1
 if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
 return redis.call('PEXPIRE',KEYS[1],ARGV[2])`;
export const LIVE_RELEASE_SCRIPT=`-- live-release-v1
 if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
 return redis.call('DEL',KEYS[1])`;
export const LIVE_SAVE_SCRIPT=`-- live-save-v1
 if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
 local valid,next = pcall(cjson.decode,ARGV[2])
 if not valid or next.schema ~= 1 or next.sessionKey ~= ARGV[3] then return -1 end
 local sourceMs,receivedMs = tonumber(ARGV[4]),tonumber(ARGV[5])
 local previous = redis.call('GET',KEYS[2])
 if previous then
   local ok,old = pcall(cjson.decode,previous)
   if not ok or not tonumber(old.sourceMs) or not tonumber(old.receivedMs) then return -3 end
   if tonumber(old.sourceMs) > sourceMs or (tonumber(old.sourceMs) == sourceMs and tonumber(old.receivedMs) > receivedMs) then return -2 end
 end
 redis.call('SET',KEYS[2],cjson.encode({sourceMs=sourceMs,receivedMs=receivedMs,snapshot=next}),'EX',ARGV[6])
 return 1`;

function validKey(value:string){return /^[a-z0-9][a-z0-9_.:-]{0,159}$/i.test(value);}
function validOwner(value:string){return /^[a-z0-9_.:-]{1,160}$/i.test(value);}
function keys(sessionKey:string){const base=`${PREFIX}{${sessionKey}}`;return {lease:`${base}:lease`,snapshot:`${base}:snapshot`};}
export interface RedisLiveStoreOptions {permission?:LivePermission;now?:()=>number;snapshotTtlSeconds?:number;}
/** Private collector storage only. Public routes must never import this store or infer a grant from its contents. */
export class RedisLiveStore implements LiveLease {
 private readonly now:()=>number;
 private readonly ttl:number;
 constructor(private readonly redis:LiveRedisClient,private readonly options:RedisLiveStoreOptions={}){
  this.now=options.now||Date.now;this.ttl=Math.max(60,Math.min(21600,Math.floor(options.snapshotTtlSeconds||3600)));
 }
 private permitted(){return hasLivePermission(this.options.permission,this.now());}
 private leaseDuration(ttlMs:number){
  if(!Number.isFinite(ttlMs)||ttlMs<1000)return 0;
  return Math.min(60000,Math.floor(ttlMs),Date.parse(this.options.permission?.expiresAt||'')-this.now());
 }
 async acquire(sessionKey:string,owner:string,ttlMs:number):Promise<boolean>{
  if(!this.permitted()||!validKey(sessionKey)||!validOwner(owner))return false;
  const duration=this.leaseDuration(ttlMs);if(duration<1000)return false;
  return await this.redis.set(keys(sessionKey).lease,owner,{nx:true,px:duration})==='OK';
 }
 async renew(sessionKey:string,owner:string,ttlMs:number):Promise<boolean>{
  if(!this.permitted()||!validKey(sessionKey)||!validOwner(owner))return false;
  const duration=this.leaseDuration(ttlMs);if(duration<1000)return false;
  return Number(await this.redis.eval(LIVE_RENEW_SCRIPT,[keys(sessionKey).lease],[owner,duration]))===1;
 }
 async release(sessionKey:string,owner:string):Promise<void>{
  // An expired grant must not prevent safe token-checked cleanup.
  if(validKey(sessionKey)&&validOwner(owner))await this.redis.eval(LIVE_RELEASE_SCRIPT,[keys(sessionKey).lease],[owner]);
 }
 private parsed(input:unknown,sessionKey:string):LiveSnapshot|null{
  const result=snapshotSchema.safeParse(input);if(!result.success||result.data.sessionKey!==sessionKey)return null;
  const snapshot=result.data;
  const dates=[snapshot.sourceTimestamp,snapshot.receivedAt,...snapshot.drivers.flatMap(d=>[d.updatedAt,...Object.values(d.sourceTimestamps||{})]),...snapshot.messages.map(m=>m.date)];
  if(dates.some(date=>date&&Date.parse(date)>this.now()+5000))return null;
  return snapshot;
 }
 async loadSnapshot(sessionKey:string):Promise<LiveSnapshot|null>{
  if(!this.permitted()||!validKey(sessionKey))return null;
  const stored=await this.redis.get<unknown>(keys(sessionKey).snapshot);if(stored===null)return null;
  try{
   const serialized=typeof stored==='string'?stored:JSON.stringify(stored);if(new TextEncoder().encode(serialized).byteLength>MAX_BYTES)return null;
   const envelope=typeof stored==='string'?JSON.parse(stored):stored;
   if(!envelope||typeof envelope!=='object'||!('snapshot' in envelope))return null;
   return this.parsed((envelope as {snapshot:unknown}).snapshot,sessionKey);
  }catch{return null;}
 }
 async saveSnapshot(snapshot:LiveSnapshot,owner:string):Promise<boolean>{
  if(!this.permitted()||!validOwner(owner)||!validKey(snapshot?.sessionKey||''))return false;
  let serialized:string;
  try{serialized=JSON.stringify(snapshot);}catch{return false;}
  if(new TextEncoder().encode(serialized).byteLength>MAX_BYTES)return false;
  const valid=this.parsed(snapshot,snapshot.sessionKey);if(!valid||!valid.receivedAt)return false;
  const key=keys(valid.sessionKey),sourceMs=valid.sourceTimestamp?Date.parse(valid.sourceTimestamp):-1,receivedMs=Date.parse(valid.receivedAt);
  return Number(await this.redis.eval(LIVE_SAVE_SCRIPT,[key.lease,key.snapshot],[owner,serialized,valid.sessionKey,sourceMs,receivedMs,this.ttl]))===1;
 }
}
