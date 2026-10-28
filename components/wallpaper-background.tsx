'use client';

import {useEffect,useRef,useState} from 'react';

const preferenceKey='apex:wallpaper';
const poster='/wallpapers/nachoneko-poster.jpg';
type Connection=EventTarget & {saveData?:boolean;effectiveType?:string};

// Mounted once in the root layout: route changes never recreate the decoder.
export function WallpaperBackground(){
 const [ready,setReady]=useState(false);
 const [enabled,setEnabled]=useState(false);
 const [motionAllowed,setMotionAllowed]=useState(false);
 const [compact,setCompact]=useState(false);
 const [failed,setFailed]=useState(false);
 const [playing,setPlaying]=useState(false);
 const videoRef=useRef<HTMLVideoElement>(null);

 useEffect(()=>{
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=matchMedia('(max-width: 767px)');
  const connection=(navigator as Navigator & {connection?:Connection}).connection;
  const update=()=>{setMotionAllowed(!motion.matches&&!connection?.saveData&&!/^(slow-)?2g$/.test(connection?.effectiveType||''));setCompact(mobile.matches);};
  const stored=()=>{try{setEnabled(localStorage.getItem(preferenceKey)!=='off');}catch{setEnabled(true);}};
  const storage=(event:StorageEvent)=>{if(event.key===preferenceKey||event.key===null)stored();};
  update();stored();setReady(true);
  motion.addEventListener('change',update);mobile.addEventListener('change',update);
  connection?.addEventListener('change',update);window.addEventListener('storage',storage);
  return()=>{motion.removeEventListener('change',update);mobile.removeEventListener('change',update);connection?.removeEventListener('change',update);window.removeEventListener('storage',storage);};
 },[]);

 useEffect(()=>{
  if(!ready||!enabled){delete document.documentElement.dataset.wallpaper;return;}
  document.documentElement.dataset.wallpaper='on';
  return()=>{delete document.documentElement.dataset.wallpaper;};
 },[ready,enabled]);

 useEffect(()=>{
  const video=videoRef.current;
  if(!video)return;
  let disposed=false;
  const playback=()=>{
   if(document.hidden){video.pause();return;}
   video.muted=true;
   void video.play().catch((error:unknown)=>{if(!disposed&&!document.hidden&&(!(error instanceof DOMException)||error.name!=='AbortError')){setPlaying(false);setFailed(true);}});
  };
  const pause=()=>video.pause();
  document.addEventListener('visibilitychange',playback);
  window.addEventListener('pagehide',pause);window.addEventListener('pageshow',playback);
  playback();
  return()=>{disposed=true;video.pause();document.removeEventListener('visibilitychange',playback);window.removeEventListener('pagehide',pause);window.removeEventListener('pageshow',playback);};
 },[ready,enabled,motionAllowed,compact,failed]);

 const toggle=()=>{
  const next=!enabled;setEnabled(next);setFailed(false);setPlaying(false);
  try{localStorage.setItem(preferenceKey,next?'on':'off');}catch{}
 };
 const active=ready&&enabled;
 return <>
  {active&&<div className="site-wallpaper" aria-hidden="true" data-playing={playing}>
   {/* Decorative local poster is intentionally independent of video loading. */}
   <img className="wallpaper-poster" src={poster} alt="" width={1280} height={720} decoding="async"/>
   {motionAllowed&&!failed&&<video ref={videoRef} className="wallpaper-video" src={compact?'/wallpapers/nachoneko-360.mp4':'/wallpapers/nachoneko-720.mp4'} poster={poster} autoPlay muted loop playsInline preload="metadata" width={1280} height={720} tabIndex={-1} disablePictureInPicture onPlaying={()=>{if(document.hidden){videoRef.current?.pause();return;}setPlaying(true);}} onError={()=>{setPlaying(false);setFailed(true);}}/>}
  </div>}
  <button type="button" className="wallpaper-toggle" aria-label="壁纸背景" aria-pressed={active} disabled={!ready} onClick={toggle} title={!active?'开启壁纸背景':motionAllowed&&!failed?'关闭动态壁纸，恢复原背景':'关闭静态壁纸，恢复原背景'}>
   <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="8" cy="9" r="1.4"/><path d="m4 17 5-5 4 4 3-3 4 4"/></svg>
   <span className="sr-only">{!active?'已关闭':motionAllowed&&!failed?'动态壁纸已开启':'静态壁纸已开启'}</span>
  </button>
 </>;
}
