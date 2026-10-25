import {Suspense} from 'react';
import type {Metadata} from 'next';
import {LiveTimingCenter} from '@/components/live/live-timing-center';

export const metadata: Metadata={title:'APEX LIVE TIMING · 实时赛事中心',description:'F1 赛程倒计时、已确认成绩与赛事数据状态。比赛实际状态以可信计时来源为准。',alternates:{canonical:'https://f1.tike69.cc.cd/live'}};
export default function LivePage(){return <Suspense fallback={<section className="message-state"><p role="status">正在读取赛事中心…</p></section>}><LiveTimingCenter/></Suspense>;}
