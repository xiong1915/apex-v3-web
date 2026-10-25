// lib/profile/client.ts
// APEX V3 APEX ID 个人资料客户端 API 封装与全局同步通道

'use client';

import type { UserProfile } from './service';
import { fetchCurrentSession, readIdentityOnce } from '@/lib/auth/client';

export type { UserProfile };

export async function fetchUserProfile(): Promise<{ profile: UserProfile | null; error?: string }> {
  return readIdentityOnce('profile', readUserProfile, () => ({profile:null,error:'登录状态已变化，请重试'}));
}

export async function fetchAccountProfile() {
  const [identity, initial] = await Promise.all([fetchCurrentSession(), fetchUserProfile()]);
  if (identity.error || !identity.user) return {...identity, profile:null};
  // A session refresh may finish after the first profile request.
  const profile = !initial.profile && !initial.error ? await fetchUserProfile() : initial;
  if (profile.profile && profile.profile.id !== identity.user.id) return {...identity, profile:null,error:'登录状态已变化，请重试'};
  return {...identity, ...profile, error:profile.error || (!profile.profile ? '个人资料暂不可用，请重试' : undefined)};
}

async function readUserProfile(): Promise<{ profile: UserProfile | null; error?: string }> {
  try {
    const res = await fetch('/api/profile', {
      cache: 'no-store'
    });
    if (res.status === 401) {
      return { profile: null };
    }
    const data = await res.json();
    if (!res.ok) {
      return { profile: null, error: data.error || '获取个人资料失败' };
    }
    return { profile: data.profile || null };
  } catch (err: any) {
    return { profile: null, error: err?.message || '网络连接异常' };
  }
}

export async function updateUserProfileApi(updates: {
  display_name?: string;
  favorite_team_ids?: string[];
}, expectedUserId: string): Promise<{ profile: UserProfile | null; error?: string }> {
  if (!expectedUserId) return {profile:null,error:'登录状态待确认，请重新加载个人资料'};
  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-apex-profile-owner':expectedUserId },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) {
      return { profile: data.profile || null, error: data.error || '更新失败' };
    }

    if (typeof window !== 'undefined' && data.profile) {
      window.dispatchEvent(new CustomEvent('apex:profile-updated', { detail: data.profile }));
    }

    return { profile: data.profile, error: undefined };
  } catch (err: any) {
    return { profile: null, error: err?.message || '网络连接异常' };
  }
}

export async function uploadAvatarApi(file: File | Blob, expectedUserId: string): Promise<{ profile: UserProfile | null; error?: string }> {
  if (!expectedUserId) return {profile:null,error:'登录状态待确认，请重新加载个人资料'};
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/profile/avatar', {
      method: 'POST',
      headers: { 'x-apex-profile-owner':expectedUserId },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      return { profile: data.profile || null, error: data.error || '上传头像失败' };
    }

    if (typeof window !== 'undefined' && data.profile) {
      window.dispatchEvent(new CustomEvent('apex:profile-updated', { detail: data.profile }));
    }

    return { profile: data.profile, error: undefined };
  } catch (err: any) {
    return { profile: null, error: err?.message || '网络连接异常' };
  }
}

export async function deleteAvatarApi(expectedUserId: string): Promise<{ profile: UserProfile | null; error?: string }> {
  if (!expectedUserId) return {profile:null,error:'登录状态待确认，请重新加载个人资料'};
  try {
    const res = await fetch('/api/profile/avatar', {
      method: 'DELETE',
      headers: { 'x-apex-profile-owner':expectedUserId }
    });
    const data = await res.json();
    if (!res.ok) {
      return { profile: data.profile || null, error: data.error || '删除头像失败' };
    }

    if (typeof window !== 'undefined' && data.profile) {
      window.dispatchEvent(new CustomEvent('apex:profile-updated', { detail: data.profile }));
    }

    return { profile: data.profile, error: undefined };
  } catch (err: any) {
    return { profile: null, error: err?.message || '网络连接异常' };
  }
}
