// lib/profile/service.ts
// APEX V3 APEX ID 个人中心服务端核心业务逻辑
// 聚合 Supabase PostgreSQL 持久化、Storage 隔离存储与本地测试无缝降级

import { User } from '@/lib/auth/types';
import { isSupabaseConfigured, AUTH_CONFIG } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/auth/server';
import { validateDisplayName, validateFavoriteTeamIds, validateAvatarBuffer, AvatarFormat } from './validation';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  avatar_path: string | null;
  favorite_team_ids: string[];
  provider: string; // 'google' | 'github' | 'email'
  created_at: string;
  updated_at: string;
}

// 内存降级存储 (用于本地单元测试、离线环境及数据库表就绪前的平滑过渡)
const memoryProfileStore = new Map<string, {
  display_name?: string;
  avatar_path?: string | null;
  favorite_team_ids: string[];
  updated_at: string;
}>();

// 内存头像二进制存储 (离线测试使用)
const memoryAvatarStore = new Map<string, { buffer: Buffer; mimeType: string }>();

export function getMemoryAvatar(path: string): { buffer: Buffer; mimeType: string } | undefined {
  return memoryAvatarStore.get(path);
}

export function resetMemoryProfileStore(): void {
  memoryProfileStore.clear;
  memoryAvatarStore.clear();
}

/**
 * 确定用户的初始身份提供者与第三方基础资料
 */
function resolveInitialProfileData(user: User): {
  displayName: string;
  thirdPartyAvatar: string | null;
  provider: string;
} {
  const provider =
    user.app_metadata?.provider ||
    (Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers[0] : null) ||
    user.user_metadata?.provider ||
    'email';

  const thirdPartyAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
  const rawName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'APEX 车迷';
  const validated = validateDisplayName(rawName);
  const displayName = validated.valid && validated.value ? validated.value : (user.email?.split('@')[0] || 'APEX 车迷');

  return { displayName, thirdPartyAvatar, provider };
}

/**
 * 获取或自动补全用户的 APEX ID 个人资料
 */
export async function getUserProfile(user: User): Promise<UserProfile> {
  const { displayName: defaultName, thirdPartyAvatar, provider } = resolveInitialProfileData(user);
  const nowIso = new Date().toISOString();

  // 1. 如果配置了真实 Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        // 已有资料记录
        let finalAvatarUrl: string | null = thirdPartyAvatar;
        if (data.avatar_path) {
          try {
            const { data: signedData } = await supabase.storage
              .from('avatars')
              .createSignedUrl(data.avatar_path, 86400); // 24小时签名有效期
            if (signedData?.signedUrl) {
              finalAvatarUrl = signedData.signedUrl;
            } else {
              finalAvatarUrl = `/api/profile/avatar/view?path=${encodeURIComponent(data.avatar_path)}`;
            }
          } catch {
            finalAvatarUrl = `/api/profile/avatar/view?path=${encodeURIComponent(data.avatar_path)}`;
          }
        }

        return {
          id: user.id,
          email: user.email,
          display_name: data.display_name || defaultName,
          avatar_url: finalAvatarUrl,
          avatar_path: data.avatar_path || null,
          favorite_team_ids: Array.isArray(data.favorite_team_ids) ? data.favorite_team_ids : [],
          provider,
          created_at: data.created_at || user.created_at || nowIso,
          updated_at: data.updated_at || nowIso
        };
      }

      // 如果未查到记录且非致命架构错误，尝试自动补建 Profile
      if (!error || error.code === 'PGRST116') {
        const newRecord = {
          id: user.id,
          display_name: defaultName,
          avatar_path: null,
          favorite_team_ids: [],
          created_at: nowIso,
          updated_at: nowIso
        };

        const { error: insertError } = await supabase.from('profiles').insert(newRecord);
        if (!insertError) {
          return {
            id: user.id,
            email: user.email,
            display_name: defaultName,
            avatar_url: thirdPartyAvatar,
            avatar_path: null,
            favorite_team_ids: [],
            provider,
            created_at: nowIso,
            updated_at: nowIso
          };
        }
      }
    } catch (e: any) {
      console.warn('[Profile Service] Supabase read profile degraded to memory:', e?.message);
    }
  }

  // 2. 内存/本地回退逻辑
  const mem = memoryProfileStore.get(user.id);
  let finalAvatarUrl: string | null = thirdPartyAvatar;
  if (mem?.avatar_path) {
    finalAvatarUrl = `/api/profile/avatar/view?path=${encodeURIComponent(mem.avatar_path)}`;
  }

  return {
    id: user.id,
    email: user.email,
    display_name: mem?.display_name || defaultName,
    avatar_url: finalAvatarUrl,
    avatar_path: mem?.avatar_path || null,
    favorite_team_ids: mem?.favorite_team_ids || [],
    provider,
    created_at: user.created_at || nowIso,
    updated_at: mem?.updated_at || nowIso
  };
}

/**
 * 更新用户个人资料 (昵称与车队收藏)
 */
export async function updateUserProfile(
  user: User,
  updates: { display_name?: string; favorite_team_ids?: string[] }
): Promise<{ profile: UserProfile; error?: string }> {
  const current = await getUserProfile(user);
  const patch: { display_name?: string; favorite_team_ids?: string[] } = {};

  // 1. 校验昵称
  if (updates.display_name !== undefined) {
    const val = validateDisplayName(updates.display_name);
    if (!val.valid || !val.value) {
      return { profile: current, error: val.error || '昵称格式不合法' };
    }
    patch.display_name = val.value;
  }

  // 2. 校验车队收藏
  if (updates.favorite_team_ids !== undefined) {
    const val = validateFavoriteTeamIds(updates.favorite_team_ids);
    if (!val.valid) {
      return { profile: current, error: val.error || '车队收藏数据不合法' };
    }
    patch.favorite_team_ids = val.value;
  }

  const nowIso = new Date().toISOString();

  // 3. Supabase 持久化
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const payload: any = {
        updated_at: nowIso
      };
      if (patch.display_name !== undefined) payload.display_name = patch.display_name;
      if (patch.favorite_team_ids !== undefined) payload.favorite_team_ids = patch.favorite_team_ids;

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select()
        .single();

      if (!error && data) {
        // 同步更新内存缓存以保持快速一致
        memoryProfileStore.set(user.id, {
          display_name: data.display_name,
          avatar_path: data.avatar_path,
          favorite_team_ids: data.favorite_team_ids || [],
          updated_at: data.updated_at
        });

        return {
          profile: await getUserProfile(user)
        };
      }
    } catch (e: any) {
      console.warn('[Profile Service] Supabase update profile degraded to memory:', e?.message);
    }
  }

  // 4. 内存回退保存
  const existingMem = memoryProfileStore.get(user.id) || {
    favorite_team_ids: current.favorite_team_ids,
    updated_at: nowIso
  };

  if (patch.display_name !== undefined) existingMem.display_name = patch.display_name;
  if (patch.favorite_team_ids !== undefined) existingMem.favorite_team_ids = patch.favorite_team_ids;
  existingMem.updated_at = nowIso;
  memoryProfileStore.set(user.id, existingMem);

  return {
    profile: await getUserProfile(user)
  };
}

/**
 * 上传或替换用户头像
 */
export async function uploadUserAvatar(
  user: User,
  fileBuffer: Buffer
): Promise<{ profile: UserProfile; error?: string }> {
  // 1. 严格校验文件二进制与魔数
  const validation = validateAvatarBuffer(fileBuffer);
  if (!validation.valid || !validation.ext || !validation.mimeType) {
    const current = await getUserProfile(user);
    return { profile: current, error: validation.error || '上传的文件不符合要求' };
  }

  const current = await getUserProfile(user);
  const nowMs = Date.now();
  const filePath = `${user.id}/avatar-${nowMs}.${validation.ext}`;
  const nowIso = new Date().toISOString();

  // 2. 如果配置了真实 Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();

      // 上传至 avatars 存储桶
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileBuffer, {
          contentType: validation.mimeType,
          upsert: true
        });

      if (!uploadError) {
        // 清理旧头像 (如果有)
        if (current.avatar_path && current.avatar_path !== filePath) {
          await supabase.storage.from('avatars').remove([current.avatar_path]).catch(() => null);
        }

        // 更新 profiles 表的 avatar_path
        await supabase
          .from('profiles')
          .update({ avatar_path: filePath, updated_at: nowIso })
          .eq('id', user.id);

        memoryProfileStore.set(user.id, {
          display_name: current.display_name,
          avatar_path: filePath,
          favorite_team_ids: current.favorite_team_ids,
          updated_at: nowIso
        });

        return {
          profile: await getUserProfile(user)
        };
      } else {
        console.warn('[Profile Service] Supabase upload failed, falling back to memory:', uploadError.message);
      }
    } catch (e: any) {
      console.warn('[Profile Service] Supabase storage exception:', e?.message);
    }
  }

  // 3. 内存回退存储
  memoryAvatarStore.set(filePath, { buffer: fileBuffer, mimeType: validation.mimeType });
  const existingMem = memoryProfileStore.get(user.id) || {
    display_name: current.display_name,
    favorite_team_ids: current.favorite_team_ids,
    updated_at: nowIso
  };
  existingMem.avatar_path = filePath;
  existingMem.updated_at = nowIso;
  memoryProfileStore.set(user.id, existingMem);

  return {
    profile: await getUserProfile(user)
  };
}

/**
 * 删除用户自定义头像并恢复默认
 */
export async function deleteUserAvatar(
  user: User
): Promise<{ profile: UserProfile; error?: string }> {
  const current = await getUserProfile(user);
  const nowIso = new Date().toISOString();

  if (current.avatar_path) {
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createSupabaseServerClient();
        await supabase.storage.from('avatars').remove([current.avatar_path]).catch(() => null);
        await supabase
          .from('profiles')
          .update({ avatar_path: null, updated_at: nowIso })
          .eq('id', user.id);
      } catch (e: any) {
        console.warn('[Profile Service] Supabase delete avatar exception:', e?.message);
      }
    }

    memoryAvatarStore.delete(current.avatar_path);
  }

  const existingMem = memoryProfileStore.get(user.id);
  if (existingMem) {
    existingMem.avatar_path = null;
    existingMem.updated_at = nowIso;
    memoryProfileStore.set(user.id, existingMem);
  }

  return {
    profile: await getUserProfile(user)
  };
}
