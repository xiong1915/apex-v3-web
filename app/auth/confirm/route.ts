// app/auth/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isProduction } from '@/lib/auth/config';
import { createSupabaseServerClient, getTrustedPublicOrigin } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
  const type = searchParams.get('type') || 'email';
  const next = searchParams.get('next');
  const origin = getTrustedPublicOrigin(req);

  // 既无 code 也无 token_hash 时才阻断
  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('缺少验证参数')}`);
  }

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    let session: any = null;

    if (code) {
      // 1. Supabase PKCE 授权码交换会话（官方邮件重定向标准流程）
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('验证失败或链接已过期，请重新申请')}`);
      }
      session = data.session;
    } else if (tokenHash) {
      // 2. OTP / Token 模式验证
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any
      });

      if (error) {
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('验证失败或链接已过期，请重新申请')}`);
      }
      session = data.session;
    }

    const targetUrl = type === 'recovery'
      ? `${origin}/reset-password`
      : (next && next.startsWith('/') && !next.startsWith('//') ? `${origin}${next}` : `${origin}/login?verified=true`);

    const response = NextResponse.redirect(targetUrl);

    // 会话写入持久安全 Cookie，确保进入 /reset-password 能够成功执行 updateUser
    if (session) {
      try {
        const cookieStore = await cookies();
        cookieStore.getAll().forEach((c) => {
          if (c.name.startsWith('sb-')) {
            response.cookies.set(c.name, c.value, {
              path: '/',
              httpOnly: true,
              secure: isProduction(),
              sameSite: 'lax',
              maxAge: AUTH_CONFIG.sessionMaxAge
            });
          }
        });
      } catch (_) {}

      response.cookies.set(AUTH_CONFIG.cookieName, session.access_token, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: 'lax',
        maxAge: AUTH_CONFIG.sessionMaxAge,
        path: '/'
      });

      if (session.refresh_token) {
        response.cookies.set(AUTH_CONFIG.refreshCookieName, session.refresh_token, {
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
    }

    return response;
  }

  // 生产环境绝对禁止 Mock 模式
  if (!isMockAuthAllowed()) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('系统认证服务未就绪')}`);
  }

  // Mock 模式
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password?token=${tokenHash || code}`);
  }

  if (tokenHash) {
    const result = mockAuthManager.verifyEmail(tokenHash);
    if (result.error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(result.error.message)}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?verified=true`);
}
