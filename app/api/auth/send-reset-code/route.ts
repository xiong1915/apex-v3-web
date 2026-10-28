// app/api/auth/send-reset-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCacheStore, getRateLimitStore } from '@/lib/storage';
import { sendEmail } from '@/lib/auth/email';

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

    // 1. 60 秒频次限制防刷
    const rateLimiter = getRateLimitStore();
    const rateLimit = await rateLimiter.checkRateLimit(`reset_code_rate:${email}`, 1, 60);
    if (!rateLimit.allowed) {
      const waitSeconds = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: `验证码请求过于频繁，请稍候 ${waitSeconds} 秒后再试`, retryAfterSeconds: waitSeconds },
        { status: 429, headers: { 'Retry-After': String(waitSeconds) } }
      );
    }

    // 2. 生成 6 位高安全随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. 存入分布式/内存缓存 (10 分钟有效期)
    const cache = getCacheStore();
    await cache.set(`reset_code:${email}`, { code, attempts: 0, createdAt: Date.now() }, 600);

    // 4. 向用户邮箱投递真实邮件
    let emailSent = false;
    let sendErrorMsg = '';
    const subject = `【APEX V3】您的密码重置验证码是：${code}`;
    const htmlText = `
      <div style="background:#0a0a0c; color:#fff; padding:32px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius:16px; max-width:480px; margin:0 auto; border:1px solid #222;">
        <h2 style="color:#ff2d20; margin-top:0; margin-bottom:16px; font-size:20px;">APEX V3 密码重置验证码</h2>
        <p style="color:#a1a1aa; font-size:14px; line-height:1.6; margin-bottom:24px;">
          您正在申请重置 APEX V3 账号登录密码。您的 6 位数字验证码为：
        </p>
        <div style="background:#16161a; border:1px solid #ff2d2040; border-radius:12px; padding:20px; text-align:center; margin-bottom:24px;">
          <span style="font-size:32px; font-weight:800; letter-spacing:8px; color:#ff2d20; font-family:monospace;">${code}</span>
        </div>
        <p style="color:#71717a; font-size:12px; line-height:1.6; margin-bottom:0;">
          验证码有效期为 10 分钟。如果非您本人操作，请忽略此邮件，您的账号密码保持不变。
        </p>
      </div>
    `;

    try {
      const result = await sendEmail({ to: email, subject, htmlText });
      emailSent = result.success;
      if (!emailSent) {
        sendErrorMsg = result.error || '发信服务未配置';
      }
    } catch (e: any) {
      sendErrorMsg = e.message || '网络连接异常';
    }

    if (!emailSent) {
      return NextResponse.json({
        error: `邮件投递失败（${sendErrorMsg}），发件服务尚未绑定，请联系管理员配置。`,
        emailSent: false
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      message: '验证码已发送至您的邮箱，10分钟内有效，请注意查收！',
      emailSent: true
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '发送验证码服务异常，请稍后重试' }, { status: 500 });
  }
}
