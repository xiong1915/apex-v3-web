// app/api/auth/reset-password-with-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCacheStore } from '@/lib/storage';
import { isSupabaseConfigured, isMockAuthAllowed } from '@/lib/auth/config';
import { createSupabaseAdminClient } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

interface ResetCodeEntry {
  code: string;
  attempts: number;
  createdAt: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email || !body.code || !body.password) {
      return NextResponse.json({ error: '请完整提供注册邮箱、6位验证码和新密码' }, { status: 400 });
    }

    const email = String(body.email).toLowerCase().trim();
    const code = String(body.code).trim();
    const password = String(body.password);

    if (password.length < 6) {
      return NextResponse.json({ error: '新密码长度至少需 6 位字符' }, { status: 400 });
    }

    // 1. 校验验证码
    const cache = getCacheStore();
    const cacheKey = `reset_code:${email}`;
    const entry = await cache.get<ResetCodeEntry>(cacheKey);

    if (!entry) {
      return NextResponse.json({ error: '验证码不存在或已过期，请重新获取' }, { status: 400 });
    }

    if (entry.code !== code) {
      const attempts = (entry.attempts || 0) + 1;
      if (attempts >= 5) {
        await cache.delete(cacheKey);
        return NextResponse.json({ error: '验证码错误次数过多，已作废，请重新获取' }, { status: 400 });
      }
      await cache.set(cacheKey, { ...entry, attempts }, 600);
      return NextResponse.json({ error: `验证码错误，还可尝试 ${5 - attempts} 次` }, { status: 400 });
    }

    // 验证成功，立即作废该验证码（防重放）
    await cache.delete(cacheKey);

    // 2. 更新密码
    if (isSupabaseConfigured()) {
      const admin = createSupabaseAdminClient();
      if (!admin) {
        return NextResponse.json({ error: '系统认证特权服务未就绪，请联系管理员' }, { status: 503 });
      }

      // 获取用户 ID
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email
      });

      if (linkError || !linkData?.user?.id) {
        return NextResponse.json({ error: '未找到该邮箱对应的账号，请核对邮箱' }, { status: 404 });
      }

      // 通过 Admin 特权原子更新密码
      const { error: updateError } = await admin.auth.admin.updateUserById(
        linkData.user.id,
        { password }
      );

      if (updateError) {
        return NextResponse.json({ error: updateError.message || '更新密码失败，请稍后重试' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: '密码重置成功，请使用新密码登录'
      });
    }

    // 生产环境绝对禁止 Mock
    if (!isMockAuthAllowed()) {
      return NextResponse.json({ error: '系统认证服务未就绪' }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      message: '密码重置成功，请使用新密码登录'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '重置密码服务异常，请稍后重试' }, { status: 500 });
  }
}
