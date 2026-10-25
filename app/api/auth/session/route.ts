// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isProduction, isValidUuid } from '@/lib/auth/config';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

function privateJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'private, no-store');
  return NextResponse.json(body, { ...init, headers });
}

function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(AUTH_CONFIG.cookieName, '', { maxAge: 0, path: '/' });
  res.cookies.set(AUTH_CONFIG.refreshCookieName, '', { maxAge: 0, path: '/' });
  res.cookies.set(AUTH_CONFIG.sessionCreatedAtCookieName, '', { maxAge: 0, path: '/' });
}

export async function GET(req: NextRequest) {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionCreatedAtStr = req.cookies.get(AUTH_CONFIG.sessionCreatedAtCookieName)?.value;
    if (sessionCreatedAtStr) {
      const initSec = parseInt(sessionCreatedAtStr, 10);
      if (!isNaN(initSec) && nowSec - initSec > AUTH_CONFIG.sessionMaxAge) {
        // 超过 30 天硬性周期，坚决清理会话
        const res = privateJson({ user: null, session: null });
        clearSessionCookies(res);
        return res;
      }
    }

    let session = await getServerSession(req);

    // 如果 access token 过期，尝试使用 refresh token 自动刷新
    if (!session && !req.headers.has('authorization')) {
      const refreshToken = req.cookies.get(AUTH_CONFIG.refreshCookieName)?.value;
      if (refreshToken) {
        if (isMockAuthAllowed()) {
          session = mockAuthManager.refreshSession(refreshToken);
          if (session) {
            const isAdmin = Boolean(
              AUTH_CONFIG.adminUserId &&
              isValidUuid(AUTH_CONFIG.adminUserId) &&
              session.user.id === AUTH_CONFIG.adminUserId
            );

            const safeSession = {
              expires_at: session.expires_at,
              expires_in: session.expires_in,
              aal: session.aal
            };

            const res = privateJson({
              user: {
                ...session.user,
                isAdmin
              },
              session: safeSession
            });
            res.cookies.set(AUTH_CONFIG.cookieName, session.access_token, {
              httpOnly: true,
              secure: isProduction(),
              sameSite: 'lax',
              maxAge: AUTH_CONFIG.sessionMaxAge,
              path: '/'
            });
            res.cookies.set(AUTH_CONFIG.refreshCookieName, session.refresh_token, {
              httpOnly: true,
              secure: isProduction(),
              sameSite: 'lax',
              maxAge: AUTH_CONFIG.sessionMaxAge,
              path: '/'
            });
            return res;
          }
        }
      }
    }

    if (!session) {
      return privateJson({ user: null, session: null });
    }

    const isAdmin = Boolean(
      AUTH_CONFIG.adminUserId &&
      isValidUuid(AUTH_CONFIG.adminUserId) &&
      session.user.id === AUTH_CONFIG.adminUserId
    );

    // 过滤掉内部敏感的 Refresh Token
    const safeSession = {
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      aal: session.aal
    };

    return privateJson({
      user: {
        ...session.user,
        isAdmin
      },
      session: safeSession
    });
  } catch (err: any) {
    return privateJson({ user: null, session: null, error: '身份服务暂不可用，请重试' }, { status: 503, headers:{'Cache-Control':'private, no-store'} });
  }
}
