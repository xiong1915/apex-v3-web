// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, isMockAuthAllowed } from '@/lib/auth/config';
import { createSupabaseServerClient, getTrustedPublicOrigin } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';
import { sendPasswordResetEmail } from '@/lib/auth/email';
import { getRateLimitStore } from '@/lib/storage';
import { extractClientIp } from '@/lib/auth/client-ip';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email) {
      return NextResponse.json({ error: '请提供注册邮箱' }, { status: 400 });
    }

    const email = String(body.email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 });
    }

    // 1. 请求频率限制：单 IP 与单邮箱 60 秒内仅允许 1 次申请
    const clientIp = extractClientIp(req.headers);
    const rateLimiter = getRateLimitStore();
    const [ipCheck, emailCheck] = await Promise.all([
      rateLimiter.checkRateLimit(`rate:forgot:ip:${clientIp}`, 5, 60),
      rateLimiter.checkRateLimit(`rate:forgot:email:${email}`, 1, 60)
    ]);

    if (!ipCheck.allowed || !emailCheck.allowed) {
      const waitSeconds = Math.max(
        1,
        Math.ceil(((emailCheck.allowed ? ipCheck.resetAt : emailCheck.resetAt) - Date.now()) / 1000)
      );
      return NextResponse.json(
        { error: `请求过于频繁，请稍候 ${waitSeconds} 秒后再试` },
        { status: 429, headers: { 'Retry-After': String(waitSeconds) } }
      );
    }

    const origin = getTrustedPublicOrigin(req);

    // 2. 生产环境：仅通过邮件通知通道投递重置链接，绝不在响应中暴露凭据或代签会话
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`
      });

      // 防用户枚举统一响应
      return NextResponse.json({
        message: '如果该邮箱已注册，重置邮件已发送至您的邮箱，请注意查收。'
      });
    }

    // 生产环境绝对禁止 Mock
    if (!isMockAuthAllowed()) {
      return NextResponse.json({ error: '系统认证服务未就绪' }, { status: 503 });
    }

    // Mock
    mockAuthManager.forgotPassword(email);
    const lastEmail = mockAuthManager.sentEmails[mockAuthManager.sentEmails.length - 1];
    if (lastEmail && lastEmail.to === email && lastEmail.type === 'reset') {
      const fullUrl = `${origin}${lastEmail.link}`;
      await sendPasswordResetEmail(email, fullUrl);
    }

    return NextResponse.json({
      message: '如果该邮箱已注册，重置邮件已发送至您的邮箱，请注意查收。'
    });
  } catch (err: any) {
    return NextResponse.json({ error: '重置密码服务暂不可用，请稍后重试' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
