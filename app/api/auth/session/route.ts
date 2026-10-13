// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    let session = await getServerSession(req);

    // 如果 access token 过期，尝试使用 refresh token 自动刷新
    if (!session) {
      const refreshToken = req.cookies.get(AUTH_CONFIG.refreshCookieName)?.value;
      if (refreshToken) {
        session = mockAuthManager.refreshSession(refreshToken);
        if (session) {
          const res = NextResponse.json({
            user: session.user,
            session
          });
          res.cookies.set(AUTH_CONFIG.cookieName, session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: AUTH_CONFIG.sessionMaxAge,
            path: '/'
          });
          res.cookies.set(AUTH_CONFIG.refreshCookieName, session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: AUTH_CONFIG.sessionMaxAge,
            path: '/'
          });
          return res;
        }
      }
    }

    if (!session) {
      return NextResponse.json({ user: null, session: null });
    }

    const isAdmin =
      session.user.id === AUTH_CONFIG.adminUserId ||
      session.user.email.toLowerCase() === AUTH_CONFIG.adminEmail.toLowerCase() ||
      session.user.role === 'admin' ||
      session.user.app_metadata?.role === 'admin';

    return NextResponse.json({
      user: {
        ...session.user,
        isAdmin
      },
      session
    });
  } catch (err: any) {
    return NextResponse.json({ user: null, session: null, error: err.message }, { status: 500 });
  }
}
