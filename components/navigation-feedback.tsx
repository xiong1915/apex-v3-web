'use client';
import {useEffect,useState} from 'react';
import {useLinkStatus} from 'next/link';

export function NavigationFeedback({label='正在打开页面…'}:{label?:string}){
 const {pending}=useLinkStatus();
 const [slow,setSlow]=useState(false);
 useEffect(()=>{setSlow(false);if(!pending)return;const timer=setTimeout(()=>setSlow(true),4000);return()=>clearTimeout(timer);},[pending]);
 return pending?<span className="navigation-feedback" role="status" aria-live="polite">{slow?'加载较慢，仍在读取数据，请稍候…':label}</span>:null;
}
