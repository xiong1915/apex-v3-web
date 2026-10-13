// lib/auth/client.ts
// APEX V3 客户端身份助手 (适配 Browser 环境)

'use client';

import { createBrowserClient } from '@supabase/ssr';
import { User, Session, AuthResponse } from './types';
import { AUTH_CONFIG, isSupabaseConfigured } from './config';

let browserClient: any = null;

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

export async function fetchCurrentSession(): Promise<{ user: User | null; session: Session | null }> {
  try {
    const res = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!res.ok) return { user: null, session: null };
    const data = await res.json();
    return { user: data.user || null, session: data.session || null };
  } catch (_) {
    return { user: null, session: null };
  }
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
    const json = await res.json();
    if (!res.ok) {
      return { data: null, error: { message: json.error || '注册失败', status: res.status } };
    }
    return { data: json, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e.message || '网络连接异常' } };
  }
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (_) {}
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
    return { data: json, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e.message || '网络连接异常' } };
  }
}
