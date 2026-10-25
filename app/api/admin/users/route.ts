import { NextRequest } from 'next/server';
import { getAdminUsers } from '@/lib/admin/service';
import { adminAccess, adminJson } from '../_security';

export const dynamic = 'force-dynamic';

// All branches are private and no-store, including authorization and storage outages.
export async function GET(req: NextRequest) {
  try {
    const auth = await adminAccess(req);
    if (!auth.ok) return adminJson({ error: auth.message }, auth.status);
    return adminJson(await getAdminUsers());
  } catch {
    return adminJson({ error: '用户目录暂不可用，请稍后重试' }, 503);
  }
}
