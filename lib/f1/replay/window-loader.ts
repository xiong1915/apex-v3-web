import type { ReplayFrame } from './types';

export class ReplayWindowLoader {
  private cache = new Map<string, ReplayFrame[]>();
  private pending = new Map<string, {promise:Promise<ReplayFrame[]>; controller:AbortController}>();
  load(key:number, offset:number): Promise<ReplayFrame[]> {
    const id=`${key}:${offset}`;
    const cached=this.cache.get(id);
    if(cached) return Promise.resolve(cached);
    const pending=this.pending.get(id);
    if(pending) return pending.promise;
    const controller=new AbortController();
    const promise=fetch(`/api/f1/replay?key=${key}&offset=${offset}`,{signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'回放分段加载失败');return data.frames as ReplayFrame[];})
      .then(frames=>{if(this.cache.size>=6)this.cache.delete(this.cache.keys().next().value!);this.cache.set(id,frames);return frames;})
      .finally(()=>this.pending.delete(id));
    this.pending.set(id,{promise,controller});
    return promise;
  }
  dispose(){for(const {controller} of this.pending.values())controller.abort();this.pending.clear();this.cache.clear();}
}
