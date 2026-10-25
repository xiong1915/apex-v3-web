import {SignalRFrames, handshakeFrame, subscriptionFrame, isLiveTopic} from './protocol';
import {LiveState} from './state';
import type {LivePermission, LiveSnapshot} from './types';
export interface LiveSocket {
 send(value: string): void; close(): void;
 onopen: (()=>void)|null; onmessage: ((event:{data:string})=>void)|null;
 onclose: (()=>void)|null; onerror: (()=>void)|null;
}
/** Implement with a Durable Object owner or Redis token-checked lease, never process memory in production. */
export interface LiveLease {
 acquire(key:string,owner:string,ttlMs:number):Promise<boolean>;
 renew(key:string,owner:string,ttlMs:number):Promise<boolean>;
 release(key:string,owner:string):Promise<void>;
}
export interface CollectorOptions {
 sessionKey:string; source:string; permission?:LivePermission;
 connect:()=>LiveSocket; lease:LiveLease;
 loadSnapshot:()=>Promise<LiveSnapshot|null>;
 /** Persist atomically only while owner still holds the shared lease; reject older source timestamps. */
 onSnapshot:(snapshot:LiveSnapshot,owner:string)=>Promise<void>;
 now?:()=>number; random?:()=>number;
 schedule?:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>;
 cancel?:(timer:ReturnType<typeof setTimeout>)=>void;
}
export function hasLivePermission(permission: LivePermission|undefined, now=Date.now()): boolean {
 return Boolean(permission?.publicRedistribution&&permission.reference.trim()&&Date.parse(permission.expiresAt)>now&&permission.topics.length&&permission.topics.every(isLiveTopic));
}
export function reconnectDelay(attempt:number,random=Math.random):number {return Math.min(30000,1000*2**Math.min(5,Math.max(0,attempt)))*(0.75+Math.min(1,Math.max(0,random()))*0.5);}
/** No caller in the public site starts this collector. A verified redistribution grant and shared ownership are mandatory. */
export class LiveCollector {
 private state:LiveState;
 private socket:LiveSocket|null=null;
 private handshaken=false;
 private sourceSessionVerified=false;
 private running=false;
 private generation=0;
 private attempt=0;
 private leaseHeld=false;
 private lastMessage=0;
 private timers=new Set<ReturnType<typeof setTimeout>>();
 private flushPending=false;
 private publishing=false;
 private pendingSnapshot:LiveSnapshot|null=null;
 private readonly owner=globalThis.crypto.randomUUID();
 private readonly now:()=>number;
 constructor(private readonly options:CollectorOptions){this.now=options.now||Date.now;this.state=new LiveState(options.sessionKey,undefined,options.source);}
 snapshot(){return this.state.snapshot(this.now());}
 private timer(callback:()=>void,delay:number){let handle:ReturnType<typeof setTimeout>;const run=()=>{this.timers.delete(handle);callback();};handle=this.options.schedule?this.options.schedule(run,delay):setTimeout(run,delay);this.timers.add(handle);return handle;}
 private valid(generation:number){return this.running&&generation===this.generation&&hasLivePermission(this.options.permission,this.now());}
 async start():Promise<boolean>{
  if(this.running)return true;
  if(!hasLivePermission(this.options.permission,this.now())||!this.options.permission!.topics.includes('SessionInfo'))return false;
  this.running=true;const generation=++this.generation;
  try{
   const acquired=await this.options.lease.acquire(this.options.sessionKey,this.owner,30000);
   if(!acquired){this.running=false;return false;}
   this.leaseHeld=true;
   if(!this.valid(generation)){await this.stop();return false;}
   const restored=await this.options.loadSnapshot();
   if(!this.valid(generation)){await this.stop();return false;}
   this.state=new LiveState(this.options.sessionKey,restored||undefined,this.options.source);
   this.open(generation);this.check(generation);return true;
  }catch{await this.stop();return false;}
 }
 private open(generation:number){
  if(!this.valid(generation))return;
  let socket:LiveSocket;
  try{socket=this.options.connect();}catch{this.reconnect(generation);return;}
  this.socket=socket;this.handshaken=false;this.sourceSessionVerified=false;this.lastMessage=this.now();this.state.setConnected(false);
  const frames=new SignalRFrames(this.options.sessionKey);
  const active=()=>this.valid(generation)&&this.socket===socket;
  socket.onopen=()=>{if(active())socket.send(handshakeFrame());};
  socket.onmessage=event=>{
   if(!active()||typeof event.data!=='string')return;
   try{
    const batch=frames.push(event.data,this.now());
    if(batch.error||batch.closed){this.disconnect(socket,generation);return;}
    this.lastMessage=this.now();
    if(batch.handshake){socket.send(subscriptionFrame(this.options.permission!.topics));this.handshaken=true;this.state.setConnected(true);this.attempt=0;}
    // A latest-session stream is not scoped by our requested key. Validate the
    // entire batch before accepting any timing, regardless of event order.
    const scopes=batch.events.filter(item=>item.topic==='SessionInfo'&&item.payload.Key!==undefined);
    if(scopes.some(item=>String(item.payload.Key)!==this.options.sessionKey)){void this.stop();return;}
    if(scopes.some(item=>String(item.payload.Key)===this.options.sessionKey))this.sourceSessionVerified=true;
    if(!this.sourceSessionVerified)return;
    let changed=false;
    for(const item of batch.events)if(this.options.permission!.topics.includes(item.topic))changed=this.state.apply(item,this.now())||changed;
    if(changed)this.flush(generation);
   }catch{this.disconnect(socket,generation);}
  };
  socket.onclose=()=>{if(active())this.disconnect(socket,generation);};
  socket.onerror=()=>{if(active())this.disconnect(socket,generation);};
 }
 private disconnect(socket:LiveSocket,generation:number){
  if(this.socket!==socket)return;
  this.socket=null;this.handshaken=false;socket.onopen=socket.onmessage=socket.onclose=socket.onerror=null;
  try{socket.close();}catch{}
  this.state.setConnected(false);this.flush(generation);this.reconnect(generation);
 }
 private reconnect(generation:number){
  if(!this.valid(generation))return;
  this.timer(()=>{if(this.valid(generation))void this.restoreAndOpen(generation);},reconnectDelay(this.attempt++,this.options.random));
 }
 private async restoreAndOpen(generation:number){
  try{
   const saved=await this.options.loadSnapshot();if(!this.valid(generation))return;
   const current=this.snapshot();
   if(saved&&Date.parse(saved.sourceTimestamp||'')>Date.parse(current.sourceTimestamp||'1970-01-01'))this.state=new LiveState(this.options.sessionKey,saved,this.options.source);
   this.open(generation);
  }catch{this.reconnect(generation);}
 }
 private flush(generation:number){
  if(this.flushPending)return;this.flushPending=true;
  this.timer(()=>{this.flushPending=false;if(this.valid(generation)){this.pendingSnapshot=this.snapshot();void this.publish(generation);}},200);
 }
 private async publish(generation:number){
  if(this.publishing)return;this.publishing=true;
  try{while(this.pendingSnapshot&&this.valid(generation)){const snapshot=this.pendingSnapshot;this.pendingSnapshot=null;try{await this.options.onSnapshot(snapshot,this.owner);}catch{}}}
  finally{this.publishing=false;}
 }
 private check(generation:number){
  this.timer(()=>{void(async()=>{
   if(!this.valid(generation)){await this.stop();return;}
   try{if(!await this.options.lease.renew(this.options.sessionKey,this.owner,30000)){await this.stop();return;}}catch{await this.stop();return;}
   if(!this.valid(generation))return;
   if(this.socket&&this.now()-this.lastMessage>30000)this.disconnect(this.socket,generation);
   else if(this.socket&&this.handshaken){const socket=this.socket;try{socket.send(JSON.stringify({type:6})+'\u001e');}catch{this.disconnect(socket,generation);}}
   this.flush(generation);this.check(generation);
  })();},10000);
 }
 async stop(){
  this.running=false;++this.generation;
  for(const timer of this.timers)(this.options.cancel||clearTimeout)(timer);this.timers.clear();this.flushPending=false;this.pendingSnapshot=null;
  const socket=this.socket;this.socket=null;this.handshaken=false;
  if(socket){socket.onopen=socket.onmessage=socket.onclose=socket.onerror=null;try{socket.close();}catch{}}
  this.state.setConnected(false);
  if(this.leaseHeld){this.leaseHeld=false;try{await this.options.lease.release(this.options.sessionKey,this.owner);}catch{}}
 }
}
