'use client';
import dynamic from 'next/dynamic';

import {useEffect,useRef,useState} from 'react';
const Helmet=dynamic(()=>import('./physical-helmet'),{ssr:false});
export function RaceInteraction(){
 const host=useRef<HTMLDivElement>(null),[ready,setReady]=useState(false);
 useEffect(()=>{const element=host.current;if(!element)return;const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setReady(true);observer.disconnect();}},{rootMargin:'100px'});observer.observe(element);return()=>observer.disconnect();},[]);
 return <div ref={host} className="race-interaction-slot">{ready?<Helmet/>:null}</div>;
}
