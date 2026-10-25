import type { NextRequest } from 'next/server';
import { buildLiveRedirect } from '@/lib/f1/live/links';
export const dynamic = 'force-dynamic';
export function GET(request: NextRequest) {
 const params=Object.fromEntries(request.nextUrl.searchParams);
 return Response.redirect(new URL(buildLiveRedirect(params),request.url),308);
}
export const HEAD = GET;
