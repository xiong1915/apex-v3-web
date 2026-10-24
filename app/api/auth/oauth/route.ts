// app/api/auth/oauth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isSupabaseConfigured, isMockAuthAllowed } from '@/lib/auth/config';
import { createSupabaseServerClient, getTrustedPublicOrigin } from '@/lib/auth/server';
import { safeReturnPath } from '@/lib/auth/redirect';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') as 'google' | 'github' | null;
  const rawNext = req.nextUrl.searchParams.get('next') || req.nextUrl.searchParams.get('returnUrl') || '/';
  const next = safeReturnPath(rawNext);
  const origin = getTrustedPublicOrigin(req);

  if (!provider || (provider !== 'google' && provider !== 'github')) {
    return NextResponse.json({ error: '不支持的 OAuth 提供方' }, { status: 400 });
  }

  // 1. Supabase 生产模式
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    // 最小必要权限：Google 仅 openid email profile；GitHub 仅 read:user user:email（绝不申请 repo 仓库权限）
    const scopes = provider === 'google' ? 'openid email profile' : 'read:user user:email';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes,
        queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined
      }
    });

    if (error || !data?.url) {
      return NextResponse.json({ error: error?.message || '获取 OAuth 授权地址失败' }, { status: 400 });
    }

    const response = NextResponse.redirect(data.url);

    // 显式将 Supabase SSR 生成的 PKCE code_verifier 写入客户端重定向响应
    try {
      const cookieStore = await cookies();
      cookieStore.getAll().forEach((c) => {
        if (c.name.startsWith('sb-')) {
          response.cookies.set(c.name, c.value, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
          });
        }
      });
    } catch (_) {}

    return response;
  }

  // 生产环境绝对禁止 Mock OAuth
  if (!isMockAuthAllowed()) {
    return NextResponse.json({ error: '系统认证服务未就绪，OAuth 登录暂不可用' }, { status: 503 });
  }

  // 2. 本地 Mock 回退模式 (仅限测试/模拟)
  const mockRedirectUrl = new URL('/auth/callback', origin);
  mockRedirectUrl.searchParams.set('provider', provider);
  mockRedirectUrl.searchParams.set('code', `mock_code_${provider}_${Date.now()}`);
  mockRedirectUrl.searchParams.set('next', next);

  return NextResponse.redirect(mockRedirectUrl.toString());
}
