import {Redis} from '@upstash/redis';
import {LiveCollector} from '../../lib/f1/live/collector';
import {RedisLiveStore} from '../../lib/f1/live/shared-store';
import {APPROVED_LIVE_SOURCES,sourceActive,type ApprovedLiveSource} from '../../lib/f1/live/sources';
import {connectSignalR} from '../../lib/f1/live/transport';
interface ObjectStorage {get<T>(key:string):Promise<T|undefined>;put(key:string,value:unknown):Promise<void>;setAlarm(at:number):Promise<void>;deleteAlarm():Promise<void>;}
interface Context {storage:ObjectStorage;blockConcurrencyWhile<T>(callback:()=>Promise<T>):Promise<T>;}
interface Namespace {idFromName(name:string):unknown;get(id:unknown):{fetch(request:Request):Promise<Response>};}
interface Env {LIVE_COLLECTOR:Namespace;UPSTASH_REDIS_REST_URL?:string;UPSTASH_REDIS_REST_TOKEN?:string;}
interface HostTestDependencies {sources?:readonly ApprovedLiveSource[];createCollector?:(source:ApprovedLiveSource)=>Pick<LiveCollector,'start'|'stop'>;}
/** One object per reviewed source, one Redis lease across deployments. No public control API. */
export class LiveCollectorHost {
 private collector:Pick<LiveCollector,'start'|'stop'>|null=null;
 private sourceId:string|null=null;
 private ready:Promise<unknown>;
 constructor(private ctx:Context,private env:Env,private testDependencies:HostTestDependencies={}){this.ready=ctx.blockConcurrencyWhile(async()=>{this.sourceId=await ctx.storage.get<string>('sourceId')||null;});}
 async fetch(request:Request):Promise<Response>{
  await this.ready;
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  const id=new URL(request.url).searchParams.get('source');
  if(!id||!(this.testDependencies.sources||APPROVED_LIVE_SOURCES).some(source=>source.id===id&&sourceActive(source)))return new Response('No active reviewed source',{status:403});
  if(this.sourceId&&this.sourceId!==id)return new Response('Source conflict',{status:409});
  this.sourceId=id;await this.ctx.storage.put('sourceId',id);
  const started=await this.ensureRunning();return Response.json({started},{status:started?200:503});
 }
 async alarm(){await this.ready;await this.ensureRunning();}
 private async ensureRunning():Promise<boolean>{
  const source=(this.testDependencies.sources||APPROVED_LIVE_SOURCES).find(source=>source.id===this.sourceId&&sourceActive(source));
  if(!source||!this.env.UPSTASH_REDIS_REST_URL||!this.env.UPSTASH_REDIS_REST_TOKEN){await this.collector?.stop();this.collector=null;await this.ctx.storage.deleteAlarm();return false;}
  // Alarms restore the collector after eviction; timers/live socket keep it active during a session.
  await this.ctx.storage.setAlarm(Math.min(Date.now()+60000,Date.parse(source.stopAfter),Date.parse(source.permission.expiresAt)));
  if(this.collector)return this.collector.start();
  if(this.testDependencies.createCollector){this.collector=this.testDependencies.createCollector(source);return this.collector.start();}
  const redis=new Redis({url:this.env.UPSTASH_REDIS_REST_URL,token:this.env.UPSTASH_REDIS_REST_TOKEN});
  const store=new RedisLiveStore(redis,{permission:source.permission,snapshotTtlSeconds:3600});
  this.collector=new LiveCollector({sessionKey:source.sessionKey,source:source.source,permission:source.permission,
   flushIntervalMs:2000,
   connect:()=>connectSignalR(),lease:store,loadSnapshot:()=>store.loadSnapshot(source.sessionKey),
   onSnapshot:async(snapshot,owner)=>{if(!await store.saveSnapshot(snapshot,owner))throw Error('Snapshot ownership or storage unavailable');}});
  return this.collector.start();
 }
}
export default {
 // Binding-only entry. No public administrative or upstream proxy endpoints.
 fetch(){return new Response('Not found',{status:404});},
 async scheduled(_event:unknown,env:Env,ctx:{waitUntil(promise:Promise<unknown>):void}){
  ctx.waitUntil(Promise.all(APPROVED_LIVE_SOURCES.filter(source=>sourceActive(source)).map(source=>env.LIVE_COLLECTOR.get(env.LIVE_COLLECTOR.idFromName(source.id)).fetch(new Request('https://internal/start?source='+encodeURIComponent(source.id),{method:'POST'})))));
 }
};
