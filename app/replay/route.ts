import type { NextRequest } from 'next/server';
import { buildLiveRedirect } from '@/lib/f1/live/links';
export const dynamic = 'force-dynamic';
export function GET(request: NextRequest) {
 const params=Object.fromEntries(request.nextUrl.searchParams);
 // Keep the public origin when Cloudflare forwards this request to Vercel.
 return new Response(null,{status:308,headers:{Location:buildLiveRedirect(params)}});
}
export const HEAD = GET;
