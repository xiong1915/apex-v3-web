// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: '请输入有效的邮箱和密码' }, { status: 400 });
    }

    const { email, password } = body;

    // 1. 真实 Supabase Auth 流程
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data.session) {
        return NextResponse.json(
          { error: error?.message || '邮箱或密码错误' },
          { status: error?.status || 401 }
        );
      }

      const response = NextResponse.json({
        user: data.user,
        session: data.session
      });

      // 设置 30 天持久安全 Cookie
      response.cookies.set(AUTH_CONFIG.cookieName, data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: AUTH_CONFIG.sessionMaxAge,
        path: '/'
      });

      if (data.session.refresh_token) {
        response.cookies.set(AUTH_CONFIG.refreshCookieName, data.session.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: AUTH_CONFIG.sessionMaxAge,
          path: '/'
        });
      }

      return response;
    }

    // 2. 本地 / Mock 模式
    const result = mockAuthManager.login(email, password);
    if (result.error || !result.session) {
      return NextResponse.json(
        { error: result.error?.message || '登录失败' },
        { status: result.error?.status || 401 }
      );
    }

    const response = NextResponse.json({
      user: result.user,
      session: result.session
    });

    response.cookies.set(AUTH_CONFIG.cookieName, result.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_CONFIG.sessionMaxAge,
      path: '/'
    });

    response.cookies.set(AUTH_CONFIG.refreshCookieName, result.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_CONFIG.sessionMaxAge,
      path: '/'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '服务异常' }, { status: 500 });
  }
}
