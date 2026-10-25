import { BUILD_SHA, BUILD_REPOSITORY, BUILD_TIMESTAMP } from '@/lib/build-info';
export const dynamic = 'force-dynamic';
export function GET() {
 return Response.json({ version: '3.2.0', repository: BUILD_REPOSITORY, commit: BUILD_SHA || null, builtAt: BUILD_TIMESTAMP || null }, {
  headers: { 'Cache-Control': 'no-store' }
 });
}
