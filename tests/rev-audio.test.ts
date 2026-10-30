import test from 'node:test';
import assert from 'node:assert/strict';
import { RevAudio } from '../lib/audio/rev-audio';
import { ENGINE_PRESETS } from '../lib/audio/engine-presets';
test('audio owns one graph, preserves mute/volume, releases on stop and ignores stale start', async()=>{
  const graphs: { destroyed: boolean; volume: number; muted: boolean; resolve?: (v:boolean)=>void }[]=[];
  const audio=new RevAudio(()=>{
    const graph={destroyed:false,volume:0,muted:false,resolve:undefined as ((v:boolean)=>void)|undefined}; graphs.push(graph);
    return {destroy(){graph.destroyed=true;},setVolume(v:number){graph.volume=v;},setMuted(v:boolean){graph.muted=v;},resumeAndFadeIn(){return new Promise<boolean>(r=>{graph.resolve=r;});},updateSound(){},triggerBackfire(){},readSpectrum(){}};
  });
  audio.setVolume(.3); audio.setMuted(true);
  const start=audio.start(ENGINE_PRESETS['v10-2004']);
  audio.stop(); graphs[0].resolve!(true); assert.equal(await start,false);
  assert.equal(graphs[0].destroyed,true);
  const next=audio.start(ENGINE_PRESETS['v8-2010']); graphs[1].resolve!(true);
  assert.equal(await next,true); assert.equal(graphs[1].muted,true); assert.equal(graphs[1].volume,.3);
  audio.stop(); assert.equal(graphs[1].destroyed,true);
});
