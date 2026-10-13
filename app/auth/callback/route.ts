// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

function getSafeRedirectUrl(next: string | null, origin: string): string {
  if (!next) return `${origin}/`;
  // 严格防御开放重定向漏洞 (Open Redirect)
  if (next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
    return `${origin}${next}`;
  }
  return `${origin}/`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const provider = (searchParams.get('provider') || 'google') as 'google' | 'github';
  const next = searchParams.get('next');
  const origin = req.nextUrl.origin || 'https://f1.tike69.cc.cd';

  const safeRedirect = getSafeRedirectUrl(next, origin);
  const response = NextResponse.redirect(safeRedirect);

  if (isSupabaseConfigured()) {
    if (!code) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('缺少 OAuth 授权码')}`);
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.message || 'OAuth 授权换取会话失败')}`);
    }

    response.cookies.set(AUTH_CONFIG.cookieName, data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_CONFIG.sessionMaxAge,
      path: '/'
    });
    if (data.session.refresh_token) {
      response.cookies.set(AUTH_CONFIG.refreshCookieName, data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: AUTH_CONFIG.sessionMaxAge,
        path: '/'
      });
    }
    return response;
  }

  // 仅在本地未配置 Supabase 生产凭据时进入 Mock 模式
  const { session } = mockAuthManager.loginOAuth(provider);
  response.cookies.set(AUTH_CONFIG.cookieName, session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.sessionMaxAge,
    path: '/'
  });
  response.cookies.set(AUTH_CONFIG.refreshCookieName, session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.sessionMaxAge,
    path: '/'
  });

  return response;
}
