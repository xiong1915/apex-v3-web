// lib/profile/client.ts
// APEX V3 APEX ID 个人资料客户端 API 封装与全局同步通道

'use client';

import { UserProfile } from './service';

export type { UserProfile };

export async function fetchUserProfile(): Promise<{ profile: UserProfile | null; error?: string }> {
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
}): Promise<{ profile: UserProfile | null; error?: string }> {
  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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

export async function uploadAvatarApi(file: File | Blob): Promise<{ profile: UserProfile | null; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/profile/avatar', {
      method: 'POST',
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

export async function deleteAvatarApi(): Promise<{ profile: UserProfile | null; error?: string }> {
  try {
    const res = await fetch('/api/profile/avatar', {
      method: 'DELETE'
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
