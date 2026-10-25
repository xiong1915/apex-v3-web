import { NextRequest } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isProduction } from '@/lib/auth/config';
import { verifySessionCredential } from '@/lib/auth/verified-session';
import { mockAuthManager } from '@/lib/auth/mock';
import { adminAccess, adminJson, sameOrigin, boundMFAClient, allowMFAAttempt } from '../../_security';

export const dynamic = 'force-dynamic';
// adminJson keeps every response private and no-store.

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return adminJson({ error: '请求来源不受信任' }, 403);
  try {
    const auth = await adminAccess(req, { requireAal2: false });
    if (!auth.ok) return adminJson({ error: auth.message }, auth.status);
    if (!await allowMFAAttempt(auth.user.id, 'verify')) return adminJson({ error: '验证尝试过于频繁，请稍后重试' }, 429);
    const body = await req.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) return adminJson({ error: '请输入有效的 6 位数字动态验证码' }, 400);
    let upgraded;
    if (isSupabaseConfigured()) {
      const client = await boundMFAClient(auth.session);
      const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
      if (factorError || !factors) return adminJson({ error: '验证器状态暂不可用' }, 503);
      const totp = factors.all.filter(f => f.factor_type === 'totp');
      // Once MFA is active, an abandoned enrollment secret must never grant AAL2.
      const owned = totp.some(f => f.status === 'verified') ? totp.filter(f => f.status === 'verified') : totp;
      const requested = typeof body?.factorId === 'string' ? body.factorId.trim() : '';
      const factor = requested ? owned.find(f => f.id === requested) : owned.find(f => f.status === 'verified');
      if (!factor) return adminJson({ error: '验证器不属于当前会话或尚未绑定' }, 400);
      const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) {
        const unavailable = error.status === 0 || (error.status || 0) >= 500;
        return adminJson({ error: unavailable ? '身份服务暂不可用' : '动态验证码验证失败' }, unavailable ? 503 : 400);
      }
      if (!data?.access_token) return adminJson({ error: '验证凭证未返回，请重试' }, 503);
      upgraded = await verifySessionCredential(client, { ...data, user: { id: auth.user.id } }, AUTH_CONFIG.sessionMaxAge);
      if (!upgraded || upgraded.user.id !== auth.user.id || upgraded.aal !== 'aal2') return adminJson({ error: '双重验证凭证校验失败' }, 503);
    } else {
      if (!isMockAuthAllowed()) return adminJson({ error: '系统认证服务未就绪' }, 503);
      const result = mockAuthManager.verifyAdminTOTP(auth.session.access_token, code);
      if (result.error || !result.session || result.session.user.id !== auth.user.id) return adminJson({ error: '动态验证码错误' }, 400);
      upgraded = result.session;
    }
    const res = adminJson({ success: true, aal: 'aal2', message: 'TOTP 双重验证成功' });
    const options = { httpOnly: true, secure: isProduction(), sameSite: 'lax' as const, maxAge: AUTH_CONFIG.sessionMaxAge, path: '/' };
    res.cookies.set(AUTH_CONFIG.cookieName, upgraded.access_token, options);
    if (upgraded.refresh_token) res.cookies.set(AUTH_CONFIG.refreshCookieName, upgraded.refresh_token, options);
    return res;
  } catch {
    return adminJson({ error: '身份服务暂不可用，请稍后重试' }, 503);
  }
}
