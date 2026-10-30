'use client';
import {useEffect,useRef} from 'react';
import styles from './physical-helmet.module.css';

/** Original SVG object; bounded spring simulation runs only while moving and visible. */
export default function PhysicalHelmet(){
 const root=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const el=root.current;if(!el)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const limited=(navigator.hardwareConcurrency||4)<=2;
  let visible=false,frame=0,last=0,x=0,y=0,vx=0,vy=0,tx=0,ty=0,drag:number|null=null,px=0,py=0,idle:ReturnType<typeof setTimeout>|undefined;
  const paint=()=>{el.style.transform=`translate3d(${x}px,${y}px,0) rotate(${x*.25}deg) scale(${1+Math.min(Math.abs(vx)/3000,.07)},${1-Math.min(Math.abs(vx)/4000,.05)})`;};
  const stop=()=>{cancelAnimationFrame(frame);frame=0;last=0;clearTimeout(idle);};
  const tick=(time:number)=>{frame=0;if(!visible||document.hidden||motion.matches)return;const dt=Math.min((time-(last||time-16))/1000,.032);last=time;
   vx+=((tx-x)*150-vx*18)*dt;vy+=((ty-y)*150-vy*18)*dt;x+=vx*dt;y+=vy*dt;paint();
   if(Math.abs(x-tx)+Math.abs(y-ty)+Math.abs(vx)+Math.abs(vy)>.08)frame=requestAnimationFrame(tick);else{last=0;el.style.transform=tx||ty?`translate3d(${tx}px,${ty}px,0)`:'none';}
  };
  const wake=()=>{if(visible&&!document.hidden&&!motion.matches&&!frame)frame=requestAnimationFrame(tick);};
  const reset=()=>{drag=null;tx=ty=0;el.dataset.dragging='false';wake();};
  const down=(e:PointerEvent)=>{if(motion.matches||!e.isPrimary||e.button!==0)return;drag=e.pointerId;px=e.clientX;py=e.clientY;el.setPointerCapture(e.pointerId);el.dataset.dragging='true';clearTimeout(idle);};
  const move=(e:PointerEvent)=>{if(drag===e.pointerId){tx=Math.tanh((e.clientX-px)/80)*(innerWidth<768?14:32);ty=e.pointerType==='touch'?0:Math.tanh((e.clientY-py)/80)*22;wake();}else if(e.pointerType==='mouse'&&!limited){const rect=el.getBoundingClientRect();tx=(e.clientX-rect.left-rect.width/2)*.12;ty=(e.clientY-rect.top-rect.height/2)*.12;wake();}};
  const up=(e:PointerEvent)=>{if(drag!==e.pointerId)return;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);reset();};
  const leave=()=>{if(drag===null)reset();};
  const key=(e:KeyboardEvent)=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(!motion.matches){vx=e.key==='ArrowLeft'?-200:200;vy=-110;wake();}}};
  const activate=(e:MouseEvent)=>{if(e.detail===0&&!motion.matches){vx=200;vy=-110;wake();}};
  const idleKick=()=>{if(!limited&&visible&&!document.hidden&&!motion.matches){vx=45;vy=-60;wake();}};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible){wake();clearTimeout(idle);idle=setTimeout(idleKick,8000);}else{stop();reset();}},{rootMargin:'0px'});observer.observe(el);
  const visibility=()=>{if(document.hidden){stop();drag=null;tx=ty=x=y=vx=vy=0;paint();}else wake();};
  const preference=()=>{stop();drag=null;tx=ty=x=y=vx=vy=0;paint();};
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',reset);el.addEventListener('pointerleave',leave);el.addEventListener('keydown',key);el.addEventListener('click',activate);document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',preference);
  return()=>{stop();observer.disconnect();el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('lostpointercapture',reset);el.removeEventListener('pointerleave',leave);el.removeEventListener('keydown',key);el.removeEventListener('click',activate);document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',preference);};
 },[]);
 return <button ref={root} className={styles.helmet} type="button" aria-label="互动赛车头盔：拖动后松手回弹，方向键或回车轻推" title="拖动头盔，松手回弹"><svg viewBox="0 0 180 150" aria-hidden="true"><defs>
<linearGradient id="helmet-shell" x1=".15" y1="0" x2=".85" y2="1"><stop stopColor="#fff"/><stop offset=".28" stopColor="#f4f6f9"/><stop offset=".63" stopColor="#d6e0ea"/><stop offset="1" stopColor="#8395a8"/></linearGradient>
<linearGradient id="helmet-visor" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#7297ad"/><stop offset=".25" stopColor="#223e55"/><stop offset=".65" stopColor="#0e1a29"/><stop offset="1" stopColor="#354d65"/></linearGradient>
<linearGradient id="helmet-red" x2="1" y2="1"><stop stopColor="#ff4939"/><stop offset=".5" stopColor="#dc150c"/><stop offset="1" stopColor="#930e0b"/></linearGradient>
<linearGradient id="helmet-chin" x2="0" y2="1"><stop stopColor="#f7fafc"/><stop offset="1" stopColor="#a6b5c5"/></linearGradient>
<radialGradient id="helmet-highlight" cx=".3" cy=".15" r=".8"><stop stopColor="#fff" stopOpacity=".9"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient>
</defs>
<ellipse cx="93" cy="137" rx="56" ry="5" fill="#152331" opacity=".13"/>
<path d="m43 109 5 19 41 10 48-12 5-19Z" fill="#222e3b" stroke="#0d1722"/>
<path d="M27 89C18 61 29 31 56 18c17-8 42-9 62-1 27 11 41 37 37 65l-10 40-44 13-48-7-23-17Z" fill="url(#helmet-shell)" stroke="#778b9e" strokeWidth="1.5"/>
<path d="M38 45c22-18 69-25 106-4l6 13c-39-23-78-22-117-1Z" fill="url(#helmet-red)"/>
<path d="M32 53c34-21 81-24 119-1" fill="none" stroke="#fff" strokeWidth="2"/>
<path d="M29 58c31-17 75-19 122-4l-6 36-41 12-65-13-11-15Z" fill="#101c29" stroke="#536b7f" strokeWidth="1.5"/>
<path d="M35 61c35-15 73-16 112-4l-6 29-39 10-61-12Z" fill="url(#helmet-visor)"/>
<path d="M43 63c22-8 49-12 71-9l-14 5-33 3-18 9Z" fill="#d4f3ff" opacity=".55"/>
<path d="m119 56 20 6-6 19-11 5Z" fill="#8fb5c9" opacity=".23"/>
<path d="M40 86c31 9 66 15 101 0" fill="none" stroke="#a2b9ca" strokeWidth=".8" opacity=".8"/>
<path d="m34 92 62 14 47-12-6 25-36 13-47-7-19-17Z" fill="url(#helmet-chin)" stroke="#869aab" strokeWidth="1"/>
<path d="m43 100 53 13 44-13-2 8-38 14-49-12Z" fill="url(#helmet-red)"/>
<path d="m53 116 42 9 39-13" fill="none" stroke="#fff" strokeWidth="1.3"/>
<path d="m101 115 17-6 10-2-2 9-25 8Z" fill="#243647"/>
<path d="m105 116 17-6m-17 10 15-5" stroke="#a4b6c6" strokeWidth="1.2"/>
<path d="m47 116 9 2 3 6-9-2Z" fill="#33495a"/>
<circle cx="39" cy="80" r="7" fill="#e1e8ef" stroke="#5e7387" strokeWidth="1.5"/><circle cx="39" cy="80" r="4.5" fill="#7f94a7"/><circle cx="39" cy="80" r="2" fill="#213346"/><path d="m37 80 4 0" stroke="#dce8ef"/>
<path d="M43 34c14-13 36-18 58-14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
<path d="M52 25c14-8 37-11 58-6" fill="none" stroke="#a8b9c8" strokeWidth=".8"/>
<path d="m78 20 15-2 5 5-17 1Zm21-1 14 2 4 5-15-2Z" fill="#283e50"/>
<path d="m80 20 12-1m10 1 10 2" stroke="#859cac" strokeWidth="1"/>
<path d="M29 58C28 37 49 17 76 14" fill="none" stroke="url(#helmet-highlight)" strokeWidth="5"/>
<path d="m145 94 6-5-4 22-7 6" fill="none" stroke="#4e657a" strokeWidth="1.2"/>
<path d="m59 130 40 6 32-8" fill="none" stroke="#e8f0f5" strokeWidth="1"/>
</svg></button>;
}
