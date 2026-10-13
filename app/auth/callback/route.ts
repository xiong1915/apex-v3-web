// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isProduction } from '@/lib/auth/config';
import { createSupabaseServerClient, getTrustedPublicOrigin } from '@/lib/auth/server';
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
  const origin = getTrustedPublicOrigin(req);

  // 严格安全防御：无有效授权码直接阻断重定向，绝对禁止无码创建会话
  if (!code || typeof code !== 'string' || !code.trim()) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('缺少有效 OAuth 授权码')}`);
  }

  const safeRedirect = getSafeRedirectUrl(next, origin);
  const response = NextResponse.redirect(safeRedirect);

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.message || 'OAuth 授权换取会话失败')}`);
    }

    response.cookies.set(AUTH_CONFIG.cookieName, data.session.access_token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      maxAge: AUTH_CONFIG.sessionMaxAge,
      path: '/'
    });
    if (data.session.refresh_token) {
      response.cookies.set(AUTH_CONFIG.refreshCookieName, data.session.refresh_token, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: 'lax',
        maxAge: AUTH_CONFIG.sessionMaxAge,
        path: '/'
      });
    }
    response.cookies.set(AUTH_CONFIG.sessionCreatedAtCookieName, `${Math.floor(Date.now() / 1000)}`, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      maxAge: AUTH_CONFIG.sessionMaxAge,
      path: '/'
    });

    return response;
  }

  // 生产环境绝对禁止进入 Mock 模式
  if (!isMockAuthAllowed()) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('系统认证服务未就绪，禁止登录')}`);
  }

  // 仅在本地测试环境下且带有 mock_code 前缀才允许模拟换取
  if (!code.startsWith('mock_code_')) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('无效的授权码')}`);
  }

  const { session } = mockAuthManager.loginOAuth(provider);
  response.cookies.set(AUTH_CONFIG.cookieName, session.access_token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.sessionMaxAge,
    path: '/'
  });
  response.cookies.set(AUTH_CONFIG.refreshCookieName, session.refresh_token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.sessionMaxAge,
    path: '/'
  });
  response.cookies.set(AUTH_CONFIG.sessionCreatedAtCookieName, `${Math.floor(Date.now() / 1000)}`, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.sessionMaxAge,
    path: '/'
  });

  return response;
}
