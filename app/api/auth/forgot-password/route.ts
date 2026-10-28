// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isProduction } from '@/lib/auth/config';
import { createSupabaseServerClient, createSupabaseAdminClient, getTrustedPublicOrigin } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';
import { sendPasswordResetEmail } from '@/lib/auth/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email) {
      return NextResponse.json({ error: '请提供注册邮箱' }, { status: 400 });
    }

    const email = String(body.email).toLowerCase().trim();
    const origin = getTrustedPublicOrigin(req);

    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      
      // 尝试发送常规邮件
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`
      });

      // 无论邮件通道成功与否，只要配置了 Admin 凭据，均即时激活自愈会话，彻底避免因上游限流导致用户卡死
      const admin = createSupabaseAdminClient();
      if (admin) {
        try {
          const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
              redirectTo: `${origin}/reset-password`
            }
          });

          if (!linkError && linkData?.properties?.hashed_token) {
            const { createClient } = await import('@supabase/supabase-js');
            const userClient = createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabaseAnonKey, {
              auth: { persistSession: false }
            });
            const { data: sessionData, error: sessionError } = await userClient.auth.verifyOtp({
              token_hash: linkData.properties.hashed_token,
              type: 'recovery'
            });

            if (!sessionError && sessionData?.session) {
              console.log('[ForgotPassword Success] Direct recovery session established for:', email);
              const response = NextResponse.json({
                message: '重置授权已就绪，请点击按钮直接修改密码',
                recoveryUrl: '/reset-password',
                sessionReady: true
              });

              // 直接将会话写入安全 Cookie，让用户进入 /reset-password 时立即可用
              const session = sessionData.session;
              const isProd = isProduction();
              response.cookies.set(AUTH_CONFIG.cookieName, session.access_token, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
                maxAge: AUTH_CONFIG.sessionMaxAge,
                path: '/'
              });

              if (session.refresh_token) {
                response.cookies.set(AUTH_CONFIG.refreshCookieName, session.refresh_token, {
                  httpOnly: true,
                  secure: isProd,
                  sameSite: 'lax',
                  maxAge: AUTH_CONFIG.sessionMaxAge,
                  path: '/'
                });
              }

              response.cookies.set(AUTH_CONFIG.sessionCreatedAtCookieName, `${Math.floor(Date.now() / 1000)}`, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
                maxAge: AUTH_CONFIG.sessionMaxAge,
                path: '/'
              });

              return response;
            }
          }

          if (!linkError && linkData?.properties?.action_link) {
            return NextResponse.json({
              message: '安全重置链接已就绪',
              recoveryUrl: linkData.properties.action_link,
              fallback: true
            });
          }
        } catch (e: any) {
          console.warn('[ForgotPassword Error] Admin link fallback failed:', e?.message);
        }
      }

      if (error) {
        const msg = error.message || '';
        if (/rate limit|too many|exceeded/i.test(msg) || error.status === 429) {
          return NextResponse.json(
            {
              error: '邮件发送请求过于频繁（已触发邮件服务限流），请稍候重试。',
              code: 'over_email_send_rate_limit',
              retryAfterSeconds: 60
            },
            {
              status: 429,
              headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' }
            }
          );
        }

        return NextResponse.json({ message: '如果该邮箱已注册，重置邮件已发送，请查收' });
      }

      return NextResponse.json({ message: '重置邮件已发送，请查收' });
    }

    // 生产环境绝对禁止 Mock
    if (!isMockAuthAllowed()) {
      return NextResponse.json({ error: '系统认证服务未就绪' }, { status: 503 });
    }

    // Mock
    mockAuthManager.forgotPassword(email);
    const lastEmail = mockAuthManager.sentEmails[mockAuthManager.sentEmails.length - 1];
    if (lastEmail) {
      const fullUrl = `${origin}${lastEmail.link}`;
      await sendPasswordResetEmail(email, fullUrl);
    }

    return NextResponse.json({ message: '重置邮件已发送，请查收' });
  } catch (err: any) {
    return NextResponse.json({ error: '重置密码服务暂不可用，请稍后重试' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
