// app/auth/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/auth/config';
import { createSupabaseServerClient, getTrustedPublicOrigin } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
  const type = searchParams.get('type') || 'email';
  const origin = getTrustedPublicOrigin(req);

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('缺少验证参数')}`);
  }

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any
    });

    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('验证失败或链接已过期')}`);
    }

    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`);
    }

    return NextResponse.redirect(`${origin}/login?verified=true`);
  }

  // Mock 模式
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password?token=${tokenHash}`);
  }

  const result = mockAuthManager.verifyEmail(tokenHash);
  if (result.error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(result.error.message)}`);
  }

  return NextResponse.redirect(`${origin}/login?verified=true`);
}
