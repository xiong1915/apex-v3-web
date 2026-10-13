// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, createSupabaseServerClient } from '@/lib/auth/server';
import { AUTH_CONFIG, isSupabaseConfigured } from '@/lib/auth/config';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
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
              const isAdmin =
                data.user.id === AUTH_CONFIG.adminUserId ||
                data.user.email?.toLowerCase() === AUTH_CONFIG.adminEmail.toLowerCase() ||
                data.user.role === 'admin' ||
                data.user.app_metadata?.role === 'admin';

              const res = NextResponse.json({
                user: {
                  ...data.user,
                  isAdmin
                },
                session: data.session
              });

              res.cookies.set(AUTH_CONFIG.cookieName, data.session.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: AUTH_CONFIG.sessionMaxAge,
                path: '/'
              });
              if (data.session.refresh_token) {
                res.cookies.set(AUTH_CONFIG.refreshCookieName, data.session.refresh_token, {
                  httpOnly: true,
                  secure: process.env.NODE_ENV === 'production',
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
        } else {
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
