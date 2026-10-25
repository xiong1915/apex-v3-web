import { NextRequest } from 'next/server';
import { isSupabaseConfigured, isMockAuthAllowed } from '@/lib/auth/config';
import { adminAccess, adminJson, sameOrigin, boundMFAClient, allowMFAAttempt } from '../../_security';

export const dynamic = 'force-dynamic';

export async function GET() {
  return adminJson({ error: '绑定验证器需要 POST 请求' }, 405, { Allow: 'POST' });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return adminJson({ error: '请求来源不受信任' }, 403);
  try {
    const auth = await adminAccess(req, { requireAal2: false });
    if (!auth.ok) return adminJson({ error: auth.message }, auth.status);
    if (req.nextUrl.searchParams.has('rebind')) return adminJson({ error: '暂不支持安全更换验证器；现有验证器将保留，请使用现有动态验证码' }, 409);
    if (!isSupabaseConfigured()) {
      if (!isMockAuthAllowed()) return adminJson({ error: '系统认证服务未就绪' }, 503);
      return adminJson({ enrolled: true, verified: true, factorId: 'mock-factor-admin', message: '本地测试：请输入测试动态验证码' });
    }
    if (!await allowMFAAttempt(auth.user.id, 'enroll')) return adminJson({ error: '请求过于频繁，请稍后重试' }, 429);
    const client = await boundMFAClient(auth.session);
    const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
    if (factorError || !factors) return adminJson({ error: '验证器状态暂不可用' }, 503);
    const totp = factors.all.filter(f => f.factor_type === 'totp');
    const verified = totp.find(f => f.status === 'verified');
    if (verified) return adminJson({ enrolled: true, verified: true, factorId: verified.id, message: '请使用已绑定的验证器完成验证；暂不支持安全更换验证器' });
    // Never delete factors here: an unverified factor can become verified concurrently.
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', issuer: 'APEX V3 Control', friendlyName: auth.user.email || 'Admin' });
    if (error || !data) return adminJson({ error: '验证器绑定暂不可用，请稍后重试' }, 503);
    return adminJson({ enrolled: true, verified: false, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri, message: '请扫码绑定并输入 6 位动态验证码' });
  } catch {
    return adminJson({ error: '身份服务暂不可用，请稍后重试' }, 503);
  }
}
