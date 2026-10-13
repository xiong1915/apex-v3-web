// app/api/auth/oauth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, isMockAuthAllowed } from '@/lib/auth/config';
import { createSupabaseServerClient, getTrustedPublicOrigin } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') as 'google' | 'github' | null;
  const next = req.nextUrl.searchParams.get('next') || '/';
  const origin = getTrustedPublicOrigin(req);

  if (!provider || (provider !== 'google' && provider !== 'github')) {
    return NextResponse.json({ error: '不支持的 OAuth 提供方' }, { status: 400 });
  }

  // 1. Supabase 生产模式
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`
      }
    });

    if (error || !data?.url) {
      return NextResponse.json({ error: error?.message || '获取 OAuth 授权地址失败' }, { status: 400 });
    }

    return NextResponse.redirect(data.url);
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
