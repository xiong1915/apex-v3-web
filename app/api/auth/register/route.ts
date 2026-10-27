// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed } from '@/lib/auth/config';
import { createSupabaseServerClient, getTrustedPublicOrigin } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';
import { sendVerificationEmail } from '@/lib/auth/email';
import { registrationError } from '@/lib/auth/registration-error';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: '请输入有效的邮箱和密码' }, { status: 400 });
    }

    const { email, password } = body;
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: '密码长度至少需 6 位字符' }, { status: 400 });
    }

    const origin = getTrustedPublicOrigin(req);

    // 1. Supabase 生产模式
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`
        }
      });

      if (error) {
        const failure=registrationError(error);
        return NextResponse.json({error:failure.message,code:failure.code,retryAfterSeconds:failure.retryAfterSeconds},{status:failure.status,headers:{'Cache-Control':'no-store',...(failure.retryAfterSeconds?{'Retry-After':String(failure.retryAfterSeconds)}:{})}});
      }

      return NextResponse.json({
        message: '注册申请已提交，请查收验证邮件以激活账号',
        user: data.user
      });
    }

    // 2. 本地 Mock 模式门禁：生产环境及未显式开启时彻底禁止
    if (!isMockAuthAllowed()) {
      return NextResponse.json(
        { error: '系统认证服务未就绪，禁止注册。请联系管理员配置认证服务。' },
        { status: 503 }
      );
    }

    const result = mockAuthManager.register(email, password);
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.status || 400 });
    }

    // 触发邮件发送（如果配置了 Resend，发送真实邮件）
    const lastEmail = mockAuthManager.sentEmails[mockAuthManager.sentEmails.length - 1];
    if (lastEmail) {
      const fullUrl = `${origin}${lastEmail.link}`;
      await sendVerificationEmail(email, fullUrl);
    }

    return NextResponse.json({
      message: '注册申请已提交，请查收验证邮件以激活账号',
      user: result.user
    });
  } catch (err: any) {
    return NextResponse.json({ error: '注册服务暂不可用，请稍后重试' }, { status: 503,headers:{'Cache-Control':'no-store'} });
  }
}
