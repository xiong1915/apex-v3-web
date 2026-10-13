// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isProduction } from '@/lib/auth/config';
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

      // 安全设计：响应体中绝不返回 Refresh Token
      const safeUser = {
        id: data.user.id,
        email: data.user.email || '',
        email_confirmed_at: data.user.email_confirmed_at,
        role: data.user.role,
        user_metadata: data.user.user_metadata,
        app_metadata: data.user.app_metadata,
        created_at: data.user.created_at
      };

      const safeSession = {
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        aal: (data.session as any)?.aal || 'aal1'
      };

      const response = NextResponse.json({
        user: safeUser,
        session: safeSession
      });

      // 设置 30 天持久安全 Cookie
      response.cookies.set(AUTH_CONFIG.cookieName, data.session.access_token, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: 'lax',
        maxAge: AUTH_CONFIG.sessionMaxAge,
        path: '/'
      });

      if (data.session.refresh_token) {
        response.cookies.set(AUTH_CONFIG.refreshCookieName, data.session.refresh_token, {
          httpOnly: true,
          secure: isProduction(),
          sameSite: 'lax',
          maxAge: AUTH_CONFIG.sessionMaxAge,
          path: '/'
        });
      }

      response.cookies.set(AUTH_CONFIG.sessionCreatedAtCookieName, `${Math.floor(Date.now() / 1000)}`, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: 'lax',
        maxAge: AUTH_CONFIG.sessionMaxAge,
        path: '/'
      });

      return response;
    }

    // 2. 本地 / Mock 模式门禁：生产环境及未显式允许时绝对拒绝
    if (!isMockAuthAllowed()) {
      return NextResponse.json(
        { error: '系统认证服务未就绪，禁止登录。请联系管理员配置认证服务。' },
        { status: 503 }
      );
    }

    const result = mockAuthManager.login(email, password);
    if (result.error || !result.session) {
      return NextResponse.json(
        { error: result.error?.message || '登录失败' },
        { status: result.error?.status || 401 }
      );
    }

    const safeUser = {
      id: result.user.id,
      email: result.user.email,
      email_confirmed_at: result.user.email_confirmed_at,
      role: result.user.role,
      user_metadata: result.user.user_metadata,
      app_metadata: result.user.app_metadata,
      created_at: result.user.created_at
    };

    const safeSession = {
      expires_at: result.session.expires_at,
      expires_in: result.session.expires_in,
      aal: result.session.aal
    };

    const response = NextResponse.json({
      user: safeUser,
      session: safeSession
    });

    response.cookies.set(AUTH_CONFIG.cookieName, result.session.access_token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      maxAge: AUTH_CONFIG.sessionMaxAge,
      path: '/'
    });

    response.cookies.set(AUTH_CONFIG.refreshCookieName, result.session.refresh_token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      maxAge: AUTH_CONFIG.sessionMaxAge,
      path: '/'
    });

    response.cookies.set(AUTH_CONFIG.sessionCreatedAtCookieName, `${Math.floor(Date.now() / 1000)}`, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      maxAge: AUTH_CONFIG.sessionMaxAge,
      path: '/'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '服务异常' }, { status: 500 });
  }
}
