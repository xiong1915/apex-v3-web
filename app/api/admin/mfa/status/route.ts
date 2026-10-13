// app/api/admin/mfa/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { AUTH_CONFIG } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session || !session.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const isAdmin =
    session.user.id === AUTH_CONFIG.adminUserId ||
    session.user.email.toLowerCase() === AUTH_CONFIG.adminEmail.toLowerCase() ||
    session.user.role === 'admin' ||
    session.user.app_metadata?.role === 'admin';

  if (!isAdmin) {
    return NextResponse.json({ error: '非管理员账号' }, { status: 403 });
  }

  const isAal2 = session.aal === 'aal2' || session.user.app_metadata?.aal === 'aal2';

  return NextResponse.json({
    isAdmin: true,
    aal: isAal2 ? 'aal2' : 'aal1',
    isAal2
  }, {
    headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' }
  });
}
