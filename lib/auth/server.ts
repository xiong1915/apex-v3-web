// lib/auth/server.ts
// APEX V3 服务端身份校验中心 (Supabase SSR + 本地 Mock 架构无缝切换)

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { User, Session } from './types';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed, isValidUuid } from './config';
import { mockAuthManager } from './mock';
import { AuthUnavailableError, checkAuthError, refreshVerifiedSession, verifySessionCredential } from './verified-session';

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

export function getTrustedPublicOrigin(req?: NextRequest): string {
  if (!req) return 'https://f1.tike69.cc.cd';

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configuredOrigin && !configuredOrigin.includes('localhost')) {
    return configuredOrigin.replace(/\/+$/, '');
  }

  const forwardedHost = req.headers.get('x-forwarded-host')?.trim();
  const forwardedProto = req.headers.get('x-forwarded-proto')?.trim() || 'https';
  if (forwardedHost && !forwardedHost.includes('vercel.app')) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = req.headers.get('host')?.trim();
  if (host && !host.includes('vercel.app') && !host.includes('localhost')) {
    return `https://${host}`;
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://f1.tike69.cc.cd';
  }

  return req.nextUrl?.origin || 'https://f1.tike69.cc.cd';
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

function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    }
  } catch (_) {}
  return null;
}


export async function getServerSession(req?: NextRequest): Promise<Session | null> {
  const isRealSupabase = isSupabaseConfigured();

  if (isRealSupabase) {
    try {
      const nowSec = Math.floor(Date.now() / 1000);

      // 验证 30 天会话绝对生命周期约束
      const cookieCreatedAt = req?.cookies.get(AUTH_CONFIG.sessionCreatedAtCookieName)?.value;
      if (cookieCreatedAt) {
        const initSec = parseInt(cookieCreatedAt, 10);
        if (!isNaN(initSec) && nowSec - initSec > AUTH_CONFIG.sessionMaxAge) {
          return null;
        }
      }

      const supabase = await createSupabaseServerClient();
      const token = extractTokenFromRequest(req);

      // Never borrow identity or MFA from another credential.
      if (token) {
        const verified = await verifySessionCredential(supabase, { access_token: token }, AUTH_CONFIG.sessionMaxAge);
        if (verified) return verified;
        if (req?.headers.get('authorization')) return null;
        const payload = parseJwtPayload(token);
        if (!payload?.exp || payload.exp > nowSec) return null;
      } else {
        const { data, error } = await supabase.auth.getSession();
        checkAuthError(error);
        if (error) return null;
        if (data.session) return verifySessionCredential(supabase, data.session, AUTH_CONFIG.sessionMaxAge);
      }
      const refreshToken = req?.cookies.get(AUTH_CONFIG.refreshCookieName)?.value;
      if (!refreshToken) return null;
      return await refreshVerifiedSession(supabase, refreshToken, AUTH_CONFIG.sessionMaxAge, async session=>{
        const cookieStore=await cookies();
        const options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,maxAge:AUTH_CONFIG.sessionMaxAge,path:'/'};
        cookieStore.set(AUTH_CONFIG.cookieName,session.access_token,options);
        if(session.refresh_token)cookieStore.set(AUTH_CONFIG.refreshCookieName,session.refresh_token,options);
      });
    } catch (e) {
      if (e instanceof AuthUnavailableError) throw e;
      checkAuthError(e);
      console.warn('[Auth Server] Session verification failed');
      return null;
    }
  }

  // 生产环境绝对禁止任何 Mock 会话
  if (!isMockAuthAllowed()) {
    return null;
  }

  // Mock / 本地测试回退模式
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
  options: { requireAal2?: boolean } = { requireAal2: true }
): Promise<{ ok: true; user: User; session: Session } | { ok: false; status: 401 | 403; message: string }> {
  const session = await getServerSession(req);
  if (!session || !session.user) {
    return { ok: false, status: 401, message: '请先登录管理员账号' };
  }

  const { user } = session;

  // 唯一管理员安全校验：只允许 ADMIN_USER_ID 指定的真实 Supabase UUID
  // 坚决杜绝默认管理员、邮箱匹配和普通角色绕过
  const configuredAdminId = AUTH_CONFIG.adminUserId;
  if (!configuredAdminId || !isValidUuid(configuredAdminId)) {
    return { ok: false, status: 403, message: '系统未配置合法的专属管理员 UUID，管理后台已锁定' };
  }

  if (user.id !== configuredAdminId) {
    return { ok: false, status: 403, message: '权限不足：仅允许专属管理员访问' };
  }

  const requireAal2 = options.requireAal2 !== false;
  if (requireAal2) {
    const isAal2 = session.aal === 'aal2';
    if (!isAal2) {
      return { ok: false, status: 403, message: '敏感管理操作需要完成 TOTP 双重安全验证 (AAL2)' };
    }
  }

  return { ok: true, user, session };
}
