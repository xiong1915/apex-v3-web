import { NextRequest, NextResponse } from 'next/server';
import { defaultF1Service } from '@/providers/f1/service';
import { renderCalendar } from '@/lib/f1/ical';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
 const season = req.nextUrl.searchParams.get('season') || String(new Date().getUTCFullYear());
 if (!/^\d{4}$/.test(season) || Number(season) < 1950 || Number(season) > new Date().getUTCFullYear() + 1)
  return NextResponse.json({ error: '无效赛季' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
 try {
  const result = await defaultF1Service.getCalendarResult(season);
  if (result.source === 'unavailable' || !result.fetchedAt || !result.data.some(r => r.sessions?.some(s => Number.isFinite(Date.parse(s.startTimeUTC)))))
   return NextResponse.json({ error: '赛历时间暂不可用，请稍后重试' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return new Response(renderCalendar(result.data, season, result.fetchedAt), { headers: {
   'Content-Type': 'text/calendar; charset=utf-8',
   'Content-Disposition': `${req.nextUrl.searchParams.has('download') ? 'attachment' : 'inline'}; filename="apex-f1-${season}.ics"`,
   'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=300',
   'X-APEX-Data-Source': result.source, 'X-APEX-Data-Stale': String(Boolean(result.isStale))
  }});
 } catch {
  return NextResponse.json({ error: '日历订阅暂不可用，请稍后重试' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
 }
}
