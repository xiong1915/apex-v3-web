"use client";

import {forwardRef,useEffect,useId,useImperativeHandle,useRef,useState,type CSSProperties,type HTMLAttributes} from 'react';
import {computeDisplacementData,getRefractionSize,supportsRefraction} from '@/lib/glass/refraction';

// Shared ceiling, independent of how many cards a route renders.
const activeLenses=new Set<HTMLElement>();
const waitingLenses=new Set<()=>void>();
type Lens={url:string;width:number;height:number};
type GlassStyle=CSSProperties & {'--glass-refraction'?:string};

/** Integrates the prototype's optical rim into existing surfaces; never owns a video or theme. */
export const LiquidGlass=forwardRef<HTMLDivElement,HTMLAttributes<HTMLDivElement>>(function LiquidGlass({children,className='',style,...props},forwardedRef){
 const root=useRef<HTMLDivElement>(null);
 const id='apex-lens-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const [lens,setLens]=useState<Lens|null>(null);
 useImperativeHandle(forwardedRef,()=>root.current!,[]);
 useEffect(()=>{
  const current=root.current;if(!current)return;
  const element:HTMLDivElement=current;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const transparency=matchMedia('(prefers-reduced-transparency: reduce)');
  const desktop=matchMedia('(min-width: 1101px)');
  let visible=false,disposed=false,generation=0,timer:ReturnType<typeof setTimeout>|undefined;
  const clear=()=>{generation++;if(timer)clearTimeout(timer);waitingLenses.delete(update);if(activeLenses.delete(element))queueMicrotask(()=>{for(const retry of [...waitingLenses])retry();});if(!disposed)setLens(null);};
  function update(){
   clear();
   if(disposed||!visible||document.hidden||document.documentElement.dataset.wallpaper!=='on'||transparency.matches||!supportsRefraction(navigator.userAgent,innerWidth,motion.matches,CSS.supports('backdrop-filter','url(#test)')) )return;
   const rect=element.getBoundingClientRect(),size=getRefractionSize(rect.width,rect.height);
   if(!size)return;
   if(activeLenses.size>=2){waitingLenses.add(update);return;}
   activeLenses.add(element);const token=generation;
   timer=setTimeout(()=>{
    if(disposed||token!==generation)return;
    try{
     const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
     const context=canvas.getContext('2d');if(!context){clear();return;}
     const radius=parseFloat(getComputedStyle(element).borderTopLeftRadius)||24;
     const pixels=computeDisplacementData({width:size.width,height:size.height,radius:radius*size.ratio,bevelDepth:10*size.ratio,dpr:1});
     context.putImageData(new ImageData(pixels.data,size.width,size.height),0,0);
     const map=canvas.toDataURL('image/png');
     if(!disposed&&token===generation)setLens({url:map,width:rect.width,height:rect.height});
    }catch{clear();}
   },120);
  };
  const intersection=new IntersectionObserver(([entry])=>{const next=Boolean(entry?.isIntersecting);if(next!==visible){visible=next;update();}},{threshold:0});intersection.observe(element);
  const resize=new ResizeObserver(update);resize.observe(element);
  const wallpaper=new MutationObserver(update);wallpaper.observe(document.documentElement,{attributes:true,attributeFilter:['data-wallpaper']});
  for(const media of [motion,transparency,desktop])media.addEventListener('change',update);
  document.addEventListener('visibilitychange',update);
  return()=>{disposed=true;clear();intersection.disconnect();resize.disconnect();wallpaper.disconnect();for(const media of [motion,transparency,desktop])media.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};
 },[]);
 const material:GlassStyle={...style,...(lens?{'--glass-refraction':`url(#${id}) blur(.5px) saturate(1.08)`}:{})};
 return <div ref={root} {...props} className={`liquid-glass ${className}`} style={material} data-glass-mode={lens?'refracted':'frosted'}>
  {lens&&<svg width="0" height="0" aria-hidden="true" focusable="false" style={{position:'absolute',width:0,height:0,pointerEvents:'none'}}><defs><filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB"><feImage href={lens.url} x="0" y="0" width={lens.width} height={lens.height} preserveAspectRatio="none" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="12" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>}
  {children}
 </div>;
});
