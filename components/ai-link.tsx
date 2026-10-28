'use client';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {NavigationFeedback} from './navigation-feedback';

export function AILink({question,children,className,onClick}:{question?:string;children:ReactNode;className?:string;onClick?:()=>void}){
 return <Link href={question?{pathname:'/ai',query:{draft:question}}:'/ai'} className={className} onClick={onClick}>{children}<NavigationFeedback label="正在打开 AI…"/></Link>;
}
