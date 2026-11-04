import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { defaultF1Service } from '@/providers/f1/service';
import { postSessionWindow } from '@/lib/f1/post-session';

export const dynamic = 'force-dynamic';

// Dedicated entry for the GitHub Actions post-race refresh. It is called
// directly on the Vercel origin, so it never traverses Cloudflare Bot Fight
// Mode. Middleware already exempts /api/cron/ from origin verification, so
// this route must fail closed on its own dedicated secret. Never accept the
// daily sync secret (CRON_SECRET) or the origin secret here.
function authorized(req: NextRequest): boolean {
  const expected = process.env.POST_RACE_REFRESH_SECRET;
  if (!expected) return false;
  const header = req.headers.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!provided || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) ||
      !(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN) || process.env.STORAGE_PROVIDER === 'memory') {
    return NextResponse.json({ error: 'Persistent storage is required' }, { status: 503 });
  }
  const season = req.nextUrl.searchParams.get('season') || String(new Date().getUTCFullYear());
  if (!/^\d{4}$/.test(season)) return NextResponse.json({ error: 'Invalid season' }, { status: 400 });
  try {
    // The calendar is only read to locate the scoring-session window. It is
    // never force-refreshed here, unlike the daily /api/cron/sync.
    const calendar = await defaultF1Service.getCalendarResult(season);
    if (calendar.source === 'unavailable') {
      return NextResponse.json({ success: false, error: 'Calendar unavailable' }, { status: 503 });
    }
    const event = postSessionWindow(calendar.data);
    if (!event) {
      return NextResponse.json({ success: true, refreshed: false, reason: 'outside_post_session_window', season });
    }
    const eventInfo = { round: event.round, type: event.type, endTimeUTC: new Date(event.end).toISOString() };
    const operations = [
      ['drivers', () => defaultF1Service.getDriverStandingsResult(season, true)],
      ['constructors', () => defaultF1Service.getConstructorStandingsResult(season, true)],
      ['lastResult', () => defaultF1Service.getLastRaceResultResult(season, true)]
    ] as const;
    const completed = await Promise.allSettled(operations.map(([, run]) => run()));
    const summary = Object.fromEntries(completed.map((result, i) => [operations[i][0],
      result.status === 'fulfilled' ? { success: result.value.source === 'live', source: result.value.source, updatedAt: result.value.fetchedAt }
        : { success: false, reason: 'Refresh failed' }]));
    const success = Object.values(summary).every(result => result.success);
    // Forced domain refreshes invalidate the cached overview, so this read
    // reports whether results and standings have actually reconciled.
    const overview = await defaultF1Service.getOverview(season);
    const reconciled = Boolean(overview.standingsCutoffVerified &&
      (overview.scopeDetail?.driverStandingsRound || 0) >= event.round &&
      (overview.scopeDetail?.constructorStandingsRound || 0) >= event.round &&
      (event.type !== 'race' || ((overview.previousRace?.round || 0) >= event.round && overview.hasLatestRaceResult === true)));
    return NextResponse.json({ success, refreshed: success, season, event: eventInfo, reconciled, summary }, { status: success ? 200 : 503 });
  } catch {
    return NextResponse.json({ success: false, error: 'Post-race refresh failed' }, { status: 503 });
  }
}
export async function POST(req: NextRequest) { return GET(req); }
