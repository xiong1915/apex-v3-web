// app/api/admin/mfa/enroll/route.ts
// APEX V3 专属管理员 TOTP 双重验证器注册 (MFA Enroll) 接口
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, createSupabaseServerClient } from '@/lib/auth/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isValidUuid } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
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
      return NextResponse.json({ error: '权限不足：仅允许专属管理员绑定 TOTP 验证器' }, { status: 403 });
    }

    if (!isSupabaseConfigured()) {
      if (isMockAuthAllowed()) {
        return NextResponse.json({
          enrolled: true,
          verified: false,
          factorId: 'mock-factor-admin',
          qrCode: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#000"/></svg>',
          secret: 'JBSWY3DPEHPK3PXP',
          uri: 'otpauth://totp/APEX%20V3%20Control:mock@admin.cc?secret=JBSWY3DPEHPK3PXP&issuer=APEX%20V3%20Control',
          message: '【测试环境 Mock】请输入 Mock 验证码 123456'
        });
      }
      return NextResponse.json({ error: '系统认证服务未就绪' }, { status: 503 });
    }

    const supabase = await createSupabaseServerClient();
    const isRebind = req.nextUrl?.searchParams?.get('rebind') === '1';

    // 1. 检查是否已经存在绑定的 TOTP 验证器
    const { data: factors, error: factorErr } = await supabase.auth.mfa.listFactors();
    if (!factorErr && factors?.totp?.length) {
      const verifiedFactor = factors.totp.find((f: any) => f.status === 'verified');
      if (verifiedFactor && !isRebind) {
        return NextResponse.json({
          enrolled: true,
          verified: true,
          factorId: verifiedFactor.id,
          message: '已绑定 TOTP 双重验证器，请输入手机验证器中的 6 位动态验证码'
        });
      }

      if (verifiedFactor && isRebind) {
        await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id }).catch(() => {});
      }

      // 若存在未完成验证的历史 factor，先清理以便生成新的绑定二维码
      for (const f of factors.totp) {
        if ((f as any).status !== 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
        }
      }
    }

    // 2. 申请新的 TOTP 注册因子 (包含二维码与密钥)
    const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'APEX V3 Control',
      friendlyName: session.user.email || 'Admin'
    });

    if (enrollErr || !enrollData) {
      return NextResponse.json({
        error: enrollErr?.message || '生成 TOTP 绑定因子失败'
      }, { status: 400 });
    }

    return NextResponse.json({
      enrolled: true,
      verified: false,
      factorId: enrollData.id,
      qrCode: enrollData.totp?.qr_code,
      secret: enrollData.totp?.secret,
      uri: enrollData.totp?.uri,
      message: '请使用手机验证器 App 扫描二维码或手动输入密钥，并输入生成的 6 位数字验证码'
    }, {
      headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'MFA Enroll 内部异常' }, { status: 500 });
  }
}
