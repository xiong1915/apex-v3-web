import {LIVE_TOPICS, type LiveEvent, type LiveTopic} from './types';
const blocked = new Set(['__proto__', 'constructor', 'prototype']);
export function isLiveTopic(value: unknown): value is LiveTopic {return typeof value === 'string' && (LIVE_TOPICS as readonly string[]).includes(value);}
function object(value: unknown): value is Record<string, unknown> {return value !== null && typeof value === 'object';}
/** F1 patches use numeric object keys to update array indices, not replace the array. */
export function deepMerge(base: unknown, patch: unknown, depth = 0): unknown {
 if (depth > 24) throw new Error('Live patch nesting limit');
 if (!object(patch)) return patch;
 const result: Record<string, unknown> | unknown[] = Array.isArray(patch) || Array.isArray(base) ? (Array.isArray(base) ? base.slice(0,256) : []) : (object(base) ? Object.fromEntries(Object.entries(base).slice(-256)) : {});
 for (const [key, value] of Object.entries(patch).slice(0, 4096)) {
  if (blocked.has(key) || (Array.isArray(result) && (!/^\d+$/.test(key) || Number(key) > 255))) continue;
  (result as Record<string, unknown>)[key] = deepMerge((result as Record<string, unknown>)[key], value, depth + 1);
 }
 return Array.isArray(result)?result:Object.fromEntries(Object.entries(result).slice(-256));
}
export const handshakeFrame = () => JSON.stringify({protocol:'json',version:1}) + '\u001e';
export function subscriptionFrame(topics: readonly LiveTopic[] = LIVE_TOPICS): string {
 if (!topics.length || topics.some(topic=>!isLiveTopic(topic))) throw new Error('Live topic not permitted');
 return JSON.stringify({type:1,invocationId:'snapshot',target:'Subscribe',arguments:[[...new Set(topics)]]})+'\u001e';
}
export interface SignalRBatch {events: LiveEvent[]; heartbeat: boolean; handshake: boolean; closed: boolean; error: string | null;}
export class SignalRFrames {
 private buffer = '';
 constructor(private readonly sessionKey: string) {}
 push(chunk: string, now = Date.now()): SignalRBatch {
  const output: SignalRBatch = {events:[],heartbeat:false,handshake:false,closed:false,error:null};
  if (chunk.length + this.buffer.length > 2_000_000) {this.buffer='';throw new Error('Live frame size limit');}
  this.buffer += chunk;
  const frames = this.buffer.split('\u001e'); this.buffer = frames.pop() || '';
  for (const text of frames) {
   if (!text.trim()) continue;
   let frame: Record<string, any>;
   try {frame=JSON.parse(text);} catch {output.error='Invalid live protocol frame';continue;}
   if (!frame || typeof frame !== 'object') continue;
   if (frame.type === 6) {output.heartbeat=true;continue;}
   if (frame.type === 7) {output.closed=true;output.error='Live source closed connection';continue;}
   if (frame.error) {output.error='Live source rejected request';continue;}
   if (!('type' in frame)) {output.handshake=true;continue;}
   const receivedAt=new Date(now).toISOString();
   if (frame.type === 1 && typeof frame.target === 'string' && frame.target.toLowerCase()==='feed') {
    const [topic,payload,timestamp]=Array.isArray(frame.arguments)?frame.arguments:[];
    if (isLiveTopic(topic) && object(payload)) output.events.push({topic,payload,sessionKey:this.sessionKey,timestamp:typeof timestamp==='string'?timestamp:null,receivedAt});
   }
   if (frame.type === 3 && object(frame.result)) {
    for (const [topic,payload] of Object.entries(frame.result)) if(isLiveTopic(topic)&&object(payload)) {
     output.events.push({topic,payload,sessionKey:this.sessionKey,timestamp:null,receivedAt,initial:true});
    }
   }
  }
  return output;
 }
}
