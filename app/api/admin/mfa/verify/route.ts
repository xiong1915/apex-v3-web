import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession, createSupabaseServerClient } from '@/lib/auth/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isProduction, isValidUuid } from '@/lib/auth/config';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session || !session.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const configuredAdminId = AUTH_CONFIG.adminUserId;
  const isConfiguredAdmin = Boolean(
    configuredAdminId &&
    isValidUuid(configuredAdminId) &&
    session.user.id === configuredAdminId
  );

  if (!isConfiguredAdmin) {
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
      const requestedFactorId = body?.factorId ? String(body.factorId).trim() : '';
      let factorId = requestedFactorId;

      if (!factorId) {
        const { data: factors, error: factorErr } = await supabase.auth.mfa.listFactors();
        if (factorErr || !factors?.totp?.length) {
          return NextResponse.json({ error: '尚未绑定 TOTP 双重验证器，请先完成扫码绑定' }, { status: 400 });
        }
        const verifiedFactor = factors.totp.find((f: any) => f.status === 'verified');
        factorId = verifiedFactor?.id || factors.totp[0].id;
      }
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code
      });
      if (challengeErr) {
        return NextResponse.json({ error: challengeErr.message || 'TOTP 验证码错误' }, { status: 400 });
      }

      const res = NextResponse.json({
        success: true,
        message: 'TOTP 双重验证成功 (AAL2)',
        aal: 'aal2'
      }, {
        headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' }
      });

      // 同步 Supabase SSR 内部在 challengeAndVerify 期间写入的 cookieStore cookies
      try {
        const cookieStore = await cookies();
        cookieStore.getAll().forEach((c) => {
          if (c.name.startsWith('sb-')) {
            res.cookies.set(c.name, c.value, {
              path: '/',
              httpOnly: true,
              secure: isProduction(),
              sameSite: 'lax',
              maxAge: AUTH_CONFIG.sessionMaxAge
            });
          }
        });
      } catch (_) {}

      // 更新会话 Cookie 为升级后的 AAL2 凭证
      if (challengeData?.access_token) {
        res.cookies.set(AUTH_CONFIG.cookieName, challengeData.access_token, {
          httpOnly: true,
          secure: isProduction(),
          sameSite: 'lax',
          maxAge: AUTH_CONFIG.sessionMaxAge,
          path: '/'
        });
      }
      if (challengeData?.refresh_token) {
        res.cookies.set(AUTH_CONFIG.refreshCookieName, challengeData.refresh_token, {
          httpOnly: true,
          secure: isProduction(),
          sameSite: 'lax',
          maxAge: AUTH_CONFIG.sessionMaxAge,
          path: '/'
        });
      }

      return res;
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'TOTP 验证异常' }, { status: 500 });
    }
  }

  // 生产环境绝对禁止 Mock
  if (!isMockAuthAllowed()) {
    return NextResponse.json({ error: '系统认证服务未就绪，禁止执行 TOTP 验证' }, { status: 503 });
  }

  // 2. 本地测试 Mock 模式
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
    secure: isProduction(),
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.sessionMaxAge,
    path: '/'
  });

  return res;
}
