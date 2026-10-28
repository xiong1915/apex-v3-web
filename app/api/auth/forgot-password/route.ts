// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed } from '@/lib/auth/config';
import { createSupabaseServerClient, getTrustedPublicOrigin } from '@/lib/auth/server';
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/confirm?type=recovery`
      });

      if (error) {
        console.warn('[ForgotPassword Warning] Supabase error:', error.message, error.status);
        const msg = error.message || '';
        if (/rate limit|too many|exceeded/i.test(msg) || error.status === 429) {
          return NextResponse.json(
            {
              error: '邮件发送请求过于频繁（已触发邮件服务限流），请稍候 60 秒后再试。若已收到重置邮件，请先检查收件箱或垃圾箱。',
              code: 'over_email_send_rate_limit',
              retryAfterSeconds: 60
            },
            {
              status: 429,
              headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' }
            }
          );
        }

        // 符合 OWASP 防枚举原则：常规失败返回安全模糊响应
        return NextResponse.json({ message: '如果该邮箱已注册，重置邮件已发送，请查收您的邮箱' });
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
