// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.password) {
      return NextResponse.json({ error: '请提供新密码' }, { status: 400 });
    }

    const { password, token } = body;
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: '密码长度至少需 6 位字符' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const client = await createSupabaseServerClient();
      let updateError: any = null;

      // 1. 优先尝试从常规服务端会话 Cookie 更新
      const { error: sessionError } = await client.auth.updateUser({ password });
      updateError = sessionError;

      // 2. 若 Cookie 会话未就绪（例如来自 Hash 提取的 access_token），使用请求体中的 token 显式更新
      if (updateError && token && typeof token === 'string' && token.length > 20) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const tokenClient = createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabaseAnonKey, {
            auth: { persistSession: false },
            global: { headers: { Authorization: `Bearer ${token}` } }
          });
          const { error: directError } = await tokenClient.auth.updateUser({ password });
          updateError = directError;
        } catch (e: any) {
          console.warn('[ResetPassword Error] Direct token update failed:', e?.message);
        }
      }

      if (updateError) {
        return NextResponse.json({ error: updateError.message || '密码重置失败，请重新申请链接' }, { status: 400 });
      }
      return NextResponse.json({ message: '密码重置成功，请重新登录' });
    }

    // 生产环境绝对禁止 Mock
    if (!isMockAuthAllowed()) {
      return NextResponse.json({ error: '系统认证服务未就绪' }, { status: 503 });
    }

    // Mock
    if (!token) {
      return NextResponse.json({ error: '重置 Token 不能为空' }, { status: 400 });
    }

    const result = mockAuthManager.resetPassword(token, password);
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ message: '密码重置成功，请使用新密码登录' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '服务异常' }, { status: 500 });
  }
}
