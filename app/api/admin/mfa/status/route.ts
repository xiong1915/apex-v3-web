import { NextRequest } from 'next/server';
import { adminAccess, adminJson } from '../../_security';

export const dynamic = 'force-dynamic';
// adminJson keeps every response private and no-store.

export async function GET(req: NextRequest) {
  try {
    const auth = await adminAccess(req, { requireAal2: false });
    if (!auth.ok) return adminJson({ error: auth.message }, auth.status);
    const isAal2 = auth.session.aal === 'aal2';
    return adminJson({ isAdmin: true, aal: isAal2 ? 'aal2' : 'aal1', isAal2 });
  } catch {
    return adminJson({ error: '身份服务暂不可用，请稍后重试' }, 503);
  }
}
