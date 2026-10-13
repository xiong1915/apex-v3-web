// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/auth/config';
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
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ message: '密码重置成功，请重新登录' });
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
