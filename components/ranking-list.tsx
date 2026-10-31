'use client';

import {useId,useRef,useState,type ReactNode} from 'react';

/** Shared disclosure for long classifications; rows stay semantic and keep their original order. */
export function RankingList({count,noun='位车手',children}:{count:number;noun?:string;children:ReactNode}){
 const [expanded,setExpanded]=useState(false);
 const id=useId(),button=useRef<HTMLButtonElement>(null);
 const toggle=()=>{
  setExpanded(!expanded);
  if(expanded)requestAnimationFrame(()=>button.current?.scrollIntoView({block:'nearest',behavior:'instant'}));
 };
 return <div className="ranking-list" data-expanded={expanded}>
  <div id={id} className="ranking-content">{children}</div>
  {count>10&&<div className="ranking-disclosure"><span>显示 {expanded?count:10} / {count} {noun}</span><button type="button" className="btn-secondary" ref={button} aria-expanded={expanded} aria-controls={id} onClick={toggle}>{expanded?'收起至前 10 名':`展开全部 ${count} ${noun}`}<span aria-hidden="true">{expanded?'↑':'↓'}</span></button></div>}
 </div>;
}
