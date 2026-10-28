// lib/auth/client.ts
// APEX V3 客户端身份助手 (适配 Browser 环境)

'use client';

import { createBrowserClient } from '@supabase/ssr';
import { User, Session, AuthResponse } from './types';
import { AUTH_CONFIG, isSupabaseConfigured } from './config';
import { registrationError } from './registration-error';

let browserClient: any = null;
let identityRevision = 0;
const pendingIdentityReads = new Map<string, Promise<any>>();
const identitySignalKey = 'apex:identity-revision';
let identitySyncStarted = false;

function startIdentitySync() {
  if (typeof window === 'undefined' || identitySyncStarted) return;
  identitySyncStarted = true;
  window.addEventListener('storage', event => {
    if (event.key === identitySignalKey) invalidateIdentityReads(false);
  });
  window.addEventListener('focus', () => invalidateIdentityReads(false));
}

export function invalidateIdentityReads(broadcast = true) {
  identityRevision++;
  pendingIdentityReads.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex:identity-changed'));
    if (broadcast) {
      try { window.localStorage.setItem(identitySignalKey, `${Date.now()}:${Math.random()}`); } catch { /* Focus revalidation still works when storage is blocked. */ }
    }
  }
}

// Only pending work is shared. Completed private data is never retained here.
export function readIdentityOnce<T>(key: string, read: () => Promise<T>, stale: () => T): Promise<T> {
  startIdentitySync();
  const existing = pendingIdentityReads.get(key);
  if (existing) return existing;
  const revision = identityRevision;
  const request = read().then(result => revision === identityRevision ? result : stale()).finally(() => {
    if (pendingIdentityReads.get(key) === request) pendingIdentityReads.delete(key);
  });
  pendingIdentityReads.set(key, request);
  return request;
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(
      AUTH_CONFIG.supabaseUrl,
      AUTH_CONFIG.supabaseAnonKey
    );
  }
  return browserClient;
}

export async function fetchCurrentSession(): Promise<{ user: User | null; session: Session | null; error?: string }> {
  return readIdentityOnce('session', readCurrentSession, () => ({user:null,session:null,error:'登录状态已变化，请重试'}));
}

async function readCurrentSession(): Promise<{ user: User | null; session: Session | null; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal });
    if (res.status === 401) return {user:null,session:null};
    if (!res.ok) return {user:null,session:null,error:'身份服务暂不可用，请重试'};
    const data = await res.json();
    return { user: data.user || null, session: data.session || null };
  } catch (_) {
    return { user: null, session: null, error:controller.signal.aborted?'登录验证超时，请重试':'身份服务暂不可用，请重试' };
  } finally { clearTimeout(timer); }
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse<{ user: User; session: Session }>> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (!res.ok) {
      return { data: null, error: { message: json.error || '登录失败', status: res.status } };
    }
    invalidateIdentityReads();
    return { data: json, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e.message || '网络连接异常' } };
  }
}

export async function apiRegister(email: string, password: string): Promise<AuthResponse<{ user: User }>> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json().catch(()=>({}));
    if (!res.ok) {
      const failure=registrationError({message:json.error,code:json.code,status:res.status});
      const retry=Number(res.headers.get('Retry-After')||json.retryAfterSeconds||failure.retryAfterSeconds||0);
      return {data:null,error:{message:json.error&&/[\u4e00-\u9fff]/.test(json.error)?json.error:failure.message,status:res.status,retryAfterSeconds:res.status===429?Math.min(3600,Math.max(1,Number.isFinite(retry)&&retry>0?retry:60)):failure.retryAfterSeconds}};
    }
    invalidateIdentityReads();
    return { data: json, error: null };
  } catch (e: any) {
    return { data: null, error: { message: '注册请求未能完成，请检查网络后重试' } };
  }
}

export async function apiLogout(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST' });
  if (!response.ok) throw new Error('退出登录失败，请稍后重试');
  invalidateIdentityReads();
}

export async function apiForgotPassword(email: string): Promise<AuthResponse<{ message: string }>> {
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const json = await res.json();
    if (!res.ok) {
      return { data: null, error: { message: json.error || '发送失败', status: res.status } };
    }
    invalidateIdentityReads();
    return { data: json, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e.message || '网络连接异常' } };
  }
}

export async function apiResetPassword(password: string, token?: string): Promise<AuthResponse<{ message: string }>> {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, token })
    });
    const json = await res.json();
    if (!res.ok) {
      return { data: null, error: { message: json.error || '重置失败', status: res.status } };
    }
    invalidateIdentityReads();
    return { data: json, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e.message || '网络连接异常' } };
  }
}
