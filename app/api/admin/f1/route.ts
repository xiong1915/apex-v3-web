import { NextRequest } from 'next/server';
import { executeAdminF1Sync } from '@/lib/admin/service';
import { defaultF1Service } from '@/providers/f1/service';
import { adminAccess, adminJson, sameOrigin } from '../_security';

export const dynamic = 'force-dynamic';

// Every success or error remains private and no-store.
export async function GET(req: NextRequest) {
  try {
    const auth = await adminAccess(req);
    if (!auth.ok) return adminJson({ error: auth.message }, auth.status);
    const overview = await defaultF1Service.getOverview();
    if (!overview) return adminJson({ error: '赛事数据暂不可用' }, 503);
    return adminJson({ season: overview.season, updatedAt: overview.updatedAt, upstreamSyncSuccess: overview.upstreamSyncSuccess, isStale: overview.isStale, cutoffDesc: overview.standingsCutoffDesc, cutoffVerified: overview.standingsCutoffVerified });
  } catch { return adminJson({ error: '身份或赛事数据服务暂不可用' }, 503); }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return adminJson({ error: '请求来源不受信任' }, 403);
  try {
    const auth = await adminAccess(req, { requireAal2: true });
    if (!auth.ok) return adminJson({ error: auth.message }, auth.status);
    const result = await executeAdminF1Sync();
    return adminJson(result, result.success ? 200 : result.cooldownRemaining ? 429 : 503);
  } catch { return adminJson({ error: '身份或赛事同步服务暂不可用' }, 503); }
}
