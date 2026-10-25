import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AUTH_CONFIG, isSupabaseConfigured, isMockAuthAllowed } from '@/lib/auth/config';
import { verifyAdminAccess } from '@/lib/auth/server';
import type { Session } from '@/lib/auth/types';
import { getRateLimitStore } from '@/lib/storage';

export function adminJson(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate', ...extraHeaders } });
}

export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin || req.headers.get('sec-fetch-site') === 'cross-site') return false;
  // The existing Cloudflare gateway forwards to a Vercel host. Do not trust
  // arbitrary forwarded headers, but keep the verified public origin usable.
  try { return [new URL(req.url).origin, 'https://f1.tike69.cc.cd'].includes(new URL(origin).origin); }
  catch { return false; }
}

export async function adminAccess(req: NextRequest, options?: { requireAal2?: boolean }) {
  if (!isSupabaseConfigured() && !isMockAuthAllowed()) throw new Error('身份服务未配置');
  return verifyAdminAccess(req, options);
}

/** Never allow the SSR cookie session to select a different MFA identity. */
export async function boundMFAClient(session: Session) {
  const client = createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(session.access_token);
  if (error || !data.user || data.user.id !== session.user.id) throw new Error('MFA 身份校验暂不可用');
  return client;
}

export async function allowMFAAttempt(userId: string, operation: 'enroll' | 'verify') {
  return (await getRateLimitStore().checkRateLimit(`admin:mfa:${operation}:${userId}`, operation === 'verify' ? 5 : 3, operation === 'verify' ? 60 : 300)).allowed;
}
