import {Suspense} from 'react';
import type {Metadata} from 'next';
import {LiveTimingCenter} from '@/components/live/live-timing-center';
import {getPublicLiveService,parseLiveQuery} from '@/lib/f1/live/service';
import type {PublicLiveResponse} from '@/lib/f1/live/public-types';

export const metadata: Metadata={title:'tikeai LIVE TIMING · 实时赛事中心',description:'F1 赛程倒计时、已确认成绩与赛事数据状态。比赛实际状态以可信计时来源为准。',alternates:{canonical:'https://f1.tike69.cc.cd/live'}};

interface PageProps {
 searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LivePage({searchParams}: PageProps){
 let initialData: PublicLiveResponse | null = null;
 try {
  const resolved = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
   if (typeof value === 'string') params.set(key, value);
  }
  const query = parseLiveQuery(params);
  const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 2500));
  initialData = await Promise.race([
   getPublicLiveService().getSnapshot(query).catch(() => null),
   timeoutPromise
  ]);
 } catch {}

 return <Suspense fallback={<section className="message-state"><p role="status">正在读取赛事中心…</p></section>}><LiveTimingCenter initialData={initialData}/></Suspense>;
}
