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
        return NextResponse.json({ error: error.message }, { status: 400 });
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
    return NextResponse.json({ error: err.message || '服务异常' }, { status: 500 });
  }
}
