// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG, isSupabaseConfigured } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/auth/server';
import { mockAuthManager } from '@/lib/auth/mock';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_CONFIG.cookieName)?.value;

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createSupabaseServerClient();
        await supabase.auth.signOut();
      } catch (_) {}
    } else if (token) {
      mockAuthManager.logout(token);
    }

    const response = NextResponse.json({ success: true, message: '已安全退出登录' });

    // 清除会话 Cookie
    response.cookies.set(AUTH_CONFIG.cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });

    response.cookies.set(AUTH_CONFIG.refreshCookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '退出登录异常' }, { status: 500 });
  }
}
