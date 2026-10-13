// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured } from '@/lib/auth/config';
import { createSupabaseServerClient, getTrustedPublicOrigin } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';
import { sendVerificationEmail } from '@/lib/auth/email';

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
        return NextResponse.json({ error: error.message }, { status: error.status || 400 });
      }

      return NextResponse.json({
        message: '注册申请已提交，请查收验证邮件以激活账号',
        user: data.user
      });
    }

    // 2. 本地 Mock 模式
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
    return NextResponse.json({ error: err.message || '服务异常' }, { status: 500 });
  }
}
