// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, createSupabaseServerClient } from '@/lib/auth/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isProduction, isValidUuid } from '@/lib/auth/config';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

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
        const res = NextResponse.json({ user: null, session: null });
        clearSessionCookies(res);
        return res;
      }
    }

    let session = await getServerSession(req);

    // 如果 access token 过期，尝试使用 refresh token 自动刷新
    if (!session) {
      const refreshToken = req.cookies.get(AUTH_CONFIG.refreshCookieName)?.value;
      if (refreshToken) {
        if (isSupabaseConfigured()) {
          try {
            const supabase = await createSupabaseServerClient();
            const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
            if (!error && data.session && data.user) {
              const isAdmin = Boolean(
                AUTH_CONFIG.adminUserId &&
                isValidUuid(AUTH_CONFIG.adminUserId) &&
                data.user.id === AUTH_CONFIG.adminUserId
              );

              // 响应体中绝不返回 Refresh Token
              const safeSession = {
                expires_at: data.session.expires_at,
                expires_in: data.session.expires_in,
                aal: (data.session as any)?.aal || 'aal1'
              };

              const res = NextResponse.json({
                user: {
                  ...data.user,
                  isAdmin
                },
                session: safeSession
              });

              res.cookies.set(AUTH_CONFIG.cookieName, data.session.access_token, {
                httpOnly: true,
                secure: isProduction(),
                sameSite: 'lax',
                maxAge: AUTH_CONFIG.sessionMaxAge,
                path: '/'
              });
              if (data.session.refresh_token) {
                res.cookies.set(AUTH_CONFIG.refreshCookieName, data.session.refresh_token, {
                  httpOnly: true,
                  secure: isProduction(),
                  sameSite: 'lax',
                  maxAge: AUTH_CONFIG.sessionMaxAge,
                  path: '/'
                });
              }
              return res;
            }
          } catch (supaErr) {
            console.warn('[Auth Session] Supabase token refresh failed:', supaErr);
          }
        } else if (isMockAuthAllowed()) {
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

            const res = NextResponse.json({
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
      return NextResponse.json({ user: null, session: null });
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

    return NextResponse.json({
      user: {
        ...session.user,
        isAdmin
      },
      session: safeSession
    });
  } catch (err: any) {
    return NextResponse.json({ user: null, session: null, error: err.message }, { status: 500 });
  }
}
