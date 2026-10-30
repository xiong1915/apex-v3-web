import { F1EngineSynthesizer } from './engine-synthesizer';
import type { EnginePreset } from './engine-presets';
type Graph = Pick<F1EngineSynthesizer,'destroy'|'setVolume'|'setMuted'|'resumeAndFadeIn'|'updateSound'|'triggerBackfire'|'readSpectrum'>;
/** One graph per user gesture; generation guards prevent async start/exit races. */
export class RevAudio {
  private graph: Graph | null=null;
  private generation=0;
  private volume=.45;
  private muted=false;
  constructor(private factory: (preset: EnginePreset)=>Graph = preset=>new F1EngineSynthesizer(preset)) {}
  async start(preset: EnginePreset) {
    this.stop(); const generation=this.generation;
    const graph=this.factory(preset); this.graph=graph;
    graph.setVolume(this.volume); graph.setMuted(this.muted);
    const ok=await graph.resumeAndFadeIn();
    if(generation!==this.generation) {graph.destroy();return false;}
    if(!ok)this.stop(); return ok;
  }
  stop() {this.generation++; this.graph?.destroy(); this.graph=null;}
  setVolume(value:number) {this.volume=Math.max(0,Math.min(1,value)); this.graph?.setVolume(this.volume);}
  setMuted(value:boolean) {this.muted=value; this.graph?.setMuted(value);}
  update(rpm:number,throttle:number,limiter:boolean) {this.graph?.updateSound(rpm,throttle,limiter);}
  backfire() {this.graph?.triggerBackfire();}
  spectrum(data:Uint8Array<ArrayBuffer>) {data.fill(0);this.graph?.readSpectrum(data);}
}
