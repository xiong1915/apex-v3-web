// lib/auth/server.ts
// APEX V3 服务端身份校验中心 (Supabase SSR + 本地 Mock 架构无缝切换)

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { User, Session } from './types';
import { AUTH_CONFIG, isSupabaseConfigured } from './config';
import { mockAuthManager } from './mock';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    AUTH_CONFIG.supabaseUrl,
    AUTH_CONFIG.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge: AUTH_CONFIG.sessionMaxAge,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production'
              })
            );
          } catch (_) {
            // Server Component 中调用 setAll 会被安全忽略
          }
        }
      }
    }
  );
}

function extractTokenFromRequest(req?: NextRequest): string | null {
  if (!req) return null;

  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 2. Cookie
  const cookieToken = req.cookies.get(AUTH_CONFIG.cookieName)?.value;
  if (cookieToken) return cookieToken;

  return null;
}

export async function getServerSession(req?: NextRequest): Promise<Session | null> {
  const isRealSupabase = isSupabaseConfigured();

  if (isRealSupabase) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      // 验证 30 天最大生命周期约束
      const nowSec = Math.floor(Date.now() / 1000);
      const sessionCreatedAt = (session.user as any)?.created_at ? Math.floor(new Date(session.user.created_at).getTime() / 1000) : nowSec;
      if (nowSec - sessionCreatedAt > AUTH_CONFIG.sessionMaxAge) {
        // 超过 30 天硬性周期，拒绝自动刷新
        return null;
      }

      const aalLevel = (session as any)?.aal || (user.app_metadata?.aal as any) || 'aal1';

      return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at || (nowSec + 3600),
        expires_in: session.expires_in || 3600,
        created_at: sessionCreatedAt,
        user: {
          id: user.id,
          email: user.email || '',
          email_confirmed_at: user.email_confirmed_at,
          role: user.role,
          user_metadata: user.user_metadata,
          app_metadata: {
            ...user.app_metadata,
            aal: aalLevel
          },
          created_at: user.created_at
        },
        aal: aalLevel
      };
    } catch (e) {
      console.warn('[Auth Server] Supabase session retrieval error:', e);
      return null;
    }
  }

  // Mock / 本地回退模式
  let token = extractTokenFromRequest(req);
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(AUTH_CONFIG.cookieName)?.value || null;
    } catch (_) {}
  }

  if (!token) return null;
  return mockAuthManager.getSession(token);
}

export async function getServerUser(req?: NextRequest): Promise<User | null> {
  const session = await getServerSession(req);
  return session ? session.user : null;
}

export async function verifyAdminAccess(
  req?: NextRequest,
  options: { requireAal2?: boolean } = {}
): Promise<{ ok: true; user: User; session: Session } | { ok: false; status: 401 | 403; message: string }> {
  const session = await getServerSession(req);
  if (!session || !session.user) {
    return { ok: false, status: 401, message: '请先登录管理员账号' };
  }

  const { user } = session;
  const isAdmin =
    user.id === AUTH_CONFIG.adminUserId ||
    user.email.toLowerCase() === AUTH_CONFIG.adminEmail.toLowerCase() ||
    user.role === 'admin' ||
    user.app_metadata?.role === 'admin';

  if (!isAdmin) {
    return { ok: false, status: 403, message: '权限不足：仅允许专属管理员访问' };
  }

  if (options.requireAal2) {
    const isAal2 = session.aal === 'aal2' || user.app_metadata?.aal === 'aal2';
    if (!isAal2) {
      return { ok: false, status: 403, message: '敏感管理操作需要完成 TOTP 双重安全验证 (AAL2)' };
    }
  }

  return { ok: true, user, session };
}
