// lib/profile/service.ts
// APEX V3 APEX ID 个人中心服务端核心业务逻辑
// 生产环境严格强制 Supabase PostgreSQL & Storage 持久化，禁止虚假成功与内存掩盖

import { User } from '@/lib/auth/types';
import { isSupabaseConfigured, isProduction } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/auth/server';
import { validateDisplayName, validateFavoriteTeamIds, validateAvatarBuffer } from './validation';

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

// 仅在隔离的本地测试/Mock 模式下使用的内存存储 (生产环境严格禁止使用)
const memoryProfileStore = new Map<string, {
  display_name?: string;
  avatar_path?: string | null;
  favorite_team_ids: string[];
  updated_at: string;
}>();

// 内存头像二进制存储 (仅限本地测试使用)
const memoryAvatarStore = new Map<string, { buffer: Buffer; mimeType: string }>();

export function getMemoryAvatar(path: string): { buffer: Buffer; mimeType: string } | undefined {
  if (isProduction()) return undefined;
  return memoryAvatarStore.get(path);
}

export function resetMemoryProfileStore(): void {
  memoryProfileStore.clear();
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

  // 1. 真实 Supabase 环境
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[Profile Service] Supabase read profile failed:', error.message, error.code);
      if (isProduction()) {
        throw new Error('数据库读取失败，请稍后重试');
      }
    }

    if (data) {
      let finalAvatarUrl: string | null = thirdPartyAvatar;
      if (data.avatar_path) {
        try {
          const { data: signedData } = await supabase.storage
            .from('avatars')
            .createSignedUrl(data.avatar_path, 86400); // 24小时有效签名
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

    // 记录尚不存在时自动补建
    if (!error || error.code === 'PGRST116') {
      const newRecord = {
        id: user.id,
        display_name: defaultName,
        avatar_path: null,
        favorite_team_ids: [],
        created_at: nowIso,
        updated_at: nowIso
      };

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert(newRecord)
        .select()
        .single();

      if (!insertError && inserted) {
        return {
          id: user.id,
          email: user.email,
          display_name: inserted.display_name || defaultName,
          avatar_url: thirdPartyAvatar,
          avatar_path: null,
          favorite_team_ids: [],
          provider,
          created_at: inserted.created_at || nowIso,
          updated_at: inserted.updated_at || nowIso
        };
      }

      if (insertError && isProduction()) {
        console.error('[Profile Service] Profile auto-provisioning failed:', insertError.message);
        throw new Error('个人资料初始化失败，请稍后重试');
      }
    }
  }

  // 生产环境绝对禁止内存伪造
  if (isProduction()) {
    throw new Error('持久化存储未配置或不可用');
  }

  // 2. 本地测试/离线回退
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
 * 细化数据库错误信息映射
 */
function mapDatabaseError(error: any): string {
  if (!error) return '数据库操作失败';
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();

  if (code === '42501' || msg.includes('permission denied') || msg.includes('row-level security')) {
    return '权限不足：无法修改其他用户的个人资料';
  }
  if (code === '23505' || msg.includes('unique constraint') || msg.includes('duplicate key')) {
    return '更新冲突，请刷新后重试';
  }
  if (code === 'PGRST116' || msg.includes('no rows')) {
    return '未找到该用户的个人档案记录';
  }
  if (code === '57014' || msg.includes('timeout') || msg.includes('aborted')) {
    return '数据库请求超时，请检查网络后重试';
  }
  return error.message || '数据库服务异常，请稍后重试';
}

/**
 * 更新用户个人资料 (昵称与车队收藏)
 */
export async function updateUserProfile(
  user: User,
  updates: { display_name?: string; favorite_team_ids?: string[] }
): Promise<{ profile: UserProfile; error?: string }> {
  let current: UserProfile;
  try {
    current = await getUserProfile(user);
  } catch (e: any) {
    return {
      profile: {
        id: user.id,
        email: user.email,
        display_name: user.email?.split('@')[0] || 'APEX 车迷',
        avatar_url: null,
        avatar_path: null,
        favorite_team_ids: [],
        provider: 'email',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      error: e.message || '获取当前资料失败'
    };
  }

  const patch: { display_name?: string; favorite_team_ids?: string[] } = {};

  // 1. 严格校验昵称
  if (updates.display_name !== undefined) {
    const val = validateDisplayName(updates.display_name);
    if (!val.valid || !val.value) {
      return { profile: current, error: val.error || '昵称格式不合法' };
    }
    patch.display_name = val.value;
  }

  // 2. 严格校验车队收藏
  if (updates.favorite_team_ids !== undefined) {
    const val = validateFavoriteTeamIds(updates.favorite_team_ids);
    if (!val.valid) {
      return { profile: current, error: val.error || '车队收藏数据不合法' };
    }
    patch.favorite_team_ids = val.value;
  }

  const nowIso = new Date().toISOString();

  // 3. 生产/真实 Supabase 持久化
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

      if (error || !data) {
        console.error('[Profile Service] Supabase update failed:', error?.message);
        return {
          profile: current,
          error: mapDatabaseError(error)
        };
      }

      // 重新读取并验证数据库中的最终有效状态
      const verifiedProfile = await getUserProfile(user);
      return { profile: verifiedProfile };
    } catch (e: any) {
      console.error('[Profile Service] Supabase update exception:', e?.message);
      return {
        profile: current,
        error: isProduction() ? '保存失败，数据库连接异常' : (e.message || '保存失败')
      };
    }
  }

  // 生产环境绝对禁止内存回退伪造保存成功
  if (isProduction()) {
    return {
      profile: current,
      error: '生产环境持久化服务不可用'
    };
  }

  // 4. 仅限本地测试环境的内存更新
  const existingMem = memoryProfileStore.get(user.id) || {
    display_name: current.display_name,
    avatar_path: current.avatar_path,
    favorite_team_ids: current.favorite_team_ids,
    updated_at: nowIso
  };

  if (patch.display_name !== undefined) existingMem.display_name = patch.display_name;
  if (patch.favorite_team_ids !== undefined) existingMem.favorite_team_ids = patch.favorite_team_ids;
  existingMem.updated_at = nowIso;
  memoryProfileStore.set(user.id, existingMem);

  const updatedProfile = await getUserProfile(user);
  return { profile: updatedProfile };
}

/**
 * 上传或替换用户头像 (严格安全流程：上传新图 -> 确认DB更新 -> 清理旧图)
 */
export async function uploadUserAvatar(
  user: User,
  fileBuffer: Buffer
): Promise<{ profile: UserProfile; error?: string }> {
  let current: UserProfile;
  try {
    current = await getUserProfile(user);
  } catch (e: any) {
    return {
      profile: {
        id: user.id,
        email: user.email,
        display_name: user.email?.split('@')[0] || 'APEX 车迷',
        avatar_url: null,
        avatar_path: null,
        favorite_team_ids: [],
        provider: 'email',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      error: '读取当前用户信息失败'
    };
  }

  // 1. 严格校验文件二进制与魔数
  const validation = validateAvatarBuffer(fileBuffer);
  if (!validation.valid || !validation.ext || !validation.mimeType) {
    return { profile: current, error: validation.error || '上传的文件不符合要求' };
  }

  const nowMs = Date.now();
  const newFilePath = `${user.id}/avatar-${nowMs}.${validation.ext}`;
  const nowIso = new Date().toISOString();

  // 2. 真实 Supabase 环境执行事务型管道
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();

    // 步骤 A: 上传新头像到 Storage (当前用户独立 UUID 目录)
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(newFilePath, fileBuffer, {
        contentType: validation.mimeType,
        upsert: true
      });

    if (uploadError) {
      console.error('[Profile Service] Storage upload failed:', uploadError.message);
      return { profile: current, error: '头像存储失败: ' + uploadError.message };
    }

    // 步骤 B: 确认新头像上传成功后，更新数据库中的新头像路径
    const { data: dbData, error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_path: newFilePath, updated_at: nowIso })
      .eq('id', user.id)
      .select()
      .single();

    // 步骤 C: 如数据库更新失败，必须执行失败恢复：清理刚才上传的孤立新文件，保留旧头像和旧资料！
    if (dbError || !dbData) {
      console.error('[Profile Service] DB update failed after avatar upload, rolling back file:', dbError?.message);
      await supabase.storage.from('avatars').remove([newFilePath]).catch(() => null);
      return {
        profile: current,
        error: '数据库头像记录更新失败: ' + mapDatabaseError(dbError)
      };
    }

    // 步骤 D: 数据库成功指向新头像后，再安全清理旧头像文件 (如存在且不同)
    if (current.avatar_path && current.avatar_path !== newFilePath) {
      try {
        await supabase.storage.from('avatars').remove([current.avatar_path]);
      } catch (cleanErr) {
        console.warn('[Profile Service] Clean old avatar warning (non-fatal):', cleanErr);
      }
    }

    // 步骤 E: 重新读取并验证数据库中的有效状态
    const verifiedProfile = await getUserProfile(user);
    return { profile: verifiedProfile };
  }

  // 生产环境绝对禁止内存回退伪造成功
  if (isProduction()) {
    return { profile: current, error: '生产环境持久化存储不可用' };
  }

  // 3. 仅限本地测试环境的内存更新
  memoryAvatarStore.set(newFilePath, { buffer: fileBuffer, mimeType: validation.mimeType });
  const existingMem = memoryProfileStore.get(user.id) || {
    display_name: current.display_name,
    favorite_team_ids: current.favorite_team_ids,
    updated_at: nowIso
  };
  existingMem.avatar_path = newFilePath;
  existingMem.updated_at = nowIso;
  memoryProfileStore.set(user.id, existingMem);

  const updatedProfile = await getUserProfile(user);
  return { profile: updatedProfile };
}

/**
 * 删除用户自定义头像并恢复默认
 */
export async function deleteUserAvatar(
  user: User
): Promise<{ profile: UserProfile; error?: string }> {
  let current: UserProfile;
  try {
    current = await getUserProfile(user);
  } catch (e: any) {
    return {
      profile: {
        id: user.id,
        email: user.email,
        display_name: user.email?.split('@')[0] || 'APEX 车迷',
        avatar_url: null,
        avatar_path: null,
        favorite_team_ids: [],
        provider: 'email',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      error: '获取个人资料失败'
    };
  }

  const nowIso = new Date().toISOString();

  // 若无自定义头像，直接返回
  if (!current.avatar_path) {
    return { profile: current };
  }

  const oldPath = current.avatar_path;

  // 1. 真实 Supabase 环境：先更新数据库状态置空，再删除 Storage 文件
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();

    // 步骤 A: 优先更新数据库
    const { data: dbData, error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_path: null, updated_at: nowIso })
      .eq('id', user.id)
      .select()
      .single();

    if (dbError || !dbData) {
      console.error('[Profile Service] DB update failed during avatar deletion:', dbError?.message);
      return { profile: current, error: '删除头像记录失败: ' + mapDatabaseError(dbError) };
    }

    // 步骤 B: 数据库更新成功后，清理 Storage 文件
    await supabase.storage.from('avatars').remove([oldPath]).catch(() => null);

    // 步骤 C: 重新读取并验证状态
    const verifiedProfile = await getUserProfile(user);
    return { profile: verifiedProfile };
  }

  // 生产环境禁止假成功
  if (isProduction()) {
    return { profile: current, error: '生产环境持久化存储不可用' };
  }

  // 2. 本地测试环境的内存清理
  memoryAvatarStore.delete(oldPath);
  const existingMem = memoryProfileStore.get(user.id);
  if (existingMem) {
    existingMem.avatar_path = null;
    existingMem.updated_at = nowIso;
    memoryProfileStore.set(user.id, existingMem);
  }

  const updatedProfile = await getUserProfile(user);
  return { profile: updatedProfile };
}
