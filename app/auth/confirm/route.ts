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

  // 关键自愈容灾：Supabase 默认邮件重定向将 access_token 存放在客户端 URL Hash (#access_token=...) 中，
  // Hash 片段不会发送给服务端。当服务端检测不到 Query 参数时，返回轻量跳板 HTML，将 Hash 完整无缝透传至重置页面！
  if (!code && !tokenHash) {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>正在验证安全凭据...</title>
  <style>
    body { background: #0a0a0c; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px 32px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 14px; color: #888; margin-bottom: 8px;">正在连接 tikeai 安全验证中心...</div>
    <div style="font-size: 16px; font-weight: 600;">正在安全跳转至重置页面</div>
  </div>
  <script>
    (function() {
      var hash = window.location.hash || '';
      if (hash && (hash.indexOf('access_token=') !== -1 || hash.indexOf('type=recovery') !== -1)) {
        window.location.replace('${origin}/reset-password' + hash);
      } else {
        window.location.replace('${origin}/login?error=' + encodeURIComponent('缺少验证参数或链接已过期，请重新申请'));
      }
    })();
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
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
