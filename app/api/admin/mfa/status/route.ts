// app/api/admin/mfa/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { AUTH_CONFIG, isValidUuid } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session || !session.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const configuredAdminId = AUTH_CONFIG.adminUserId;
  const isConfiguredAdmin = Boolean(
    configuredAdminId &&
    isValidUuid(configuredAdminId) &&
    session.user.id === configuredAdminId
  );

  if (!isConfiguredAdmin) {
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
