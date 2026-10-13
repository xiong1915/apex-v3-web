// app/api/admin/mfa/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, createSupabaseServerClient } from '@/lib/auth/server';
import { AUTH_CONFIG, isSupabaseConfigured } from '@/lib/auth/config';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session || !session.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const isAdmin =
    session.user.id === AUTH_CONFIG.adminUserId ||
    session.user.email.toLowerCase() === AUTH_CONFIG.adminEmail.toLowerCase() ||
    session.user.role === 'admin' ||
    session.user.app_metadata?.role === 'admin';

  if (!isAdmin) {
    return NextResponse.json({ error: '权限不足：仅允许专属管理员进行 TOTP 验证' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const code = body?.code ? String(body.code).trim() : '';

  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    return NextResponse.json({ error: '请输入有效的 6 位数字 TOTP 动态验证码' }, { status: 400 });
  }

  // 1. Supabase 生产模式
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: factors, error: factorErr } = await supabase.auth.mfa.listFactors();
      if (factorErr || !factors?.totp?.length) {
        return NextResponse.json({ error: '尚未绑定 TOTP 双重验证器，请先在 Supabase 平台完成配置' }, { status: 400 });
      }
      const factorId = factors.totp[0].id;
      const { error: challengeErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code
      });
      if (challengeErr) {
        return NextResponse.json({ error: challengeErr.message || 'TOTP 验证码错误' }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'TOTP 双重验证成功 (AAL2)' });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'TOTP 验证异常' }, { status: 500 });
    }
  }

  // 2. Mock 模式
  const token = req.cookies.get(AUTH_CONFIG.cookieName)?.value || session.access_token;
  const result = mockAuthManager.verifyAdminTOTP(token, code);

  if (result.error || !result.session) {
    return NextResponse.json({ error: result.error?.message || '动态验证码错误' }, { status: 400 });
  }

  const res = NextResponse.json({
    success: true,
    message: 'TOTP 双重验证成功，已升级为 AAL2 安全级别',
    aal: 'aal2'
  }, {
    headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' }
  });

  // 更新会话 Cookie 为升级后的会话
  res.cookies.set(AUTH_CONFIG.cookieName, result.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.sessionMaxAge,
    path: '/'
  });

  return res;
}
