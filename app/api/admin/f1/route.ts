// app/api/admin/f1/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/server';
import { executeAdminF1Sync } from '@/lib/admin/service';
import { defaultF1Service } from '@/providers/f1/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      {
        status: auth.status,
        headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' }
      }
    );
  }

  const overview = await defaultF1Service.getOverview().catch(() => null);

  return NextResponse.json({
    season: overview?.season || '2026',
    updatedAt: overview?.updatedAt,
    upstreamSyncSuccess: overview?.upstreamSyncSuccess,
    isStale: overview?.isStale,
    cutoffDesc: overview?.standingsCutoffDesc,
    cutoffVerified: overview?.standingsCutoffVerified
  }, {
    headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' }
  });
}

export async function POST(req: NextRequest) {
  // 必须是已登录管理员，且敏感操作需要 TOTP AAL2 双重认证
  const auth = await verifyAdminAccess(req, { requireAal2: true });
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      {
        status: auth.status,
        headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' }
      }
    );
  }

  const result = await executeAdminF1Sync();
  return NextResponse.json(result, {
    status: result.success ? 200 : 429,
    headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' }
  });
}
