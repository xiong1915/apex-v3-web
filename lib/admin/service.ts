// lib/admin/service.ts
// APEX Control 私人后台业务中枢 (聚合真实系统数据、用户、AI监控及 F1 调度)

import { defaultF1Service } from '@/providers/f1/service';
import { getStorageInfo, getCacheStore } from '@/lib/storage';
import { BUILD_ID, BUILD_ENV, BUILD_TIMESTAMP } from '@/lib/build-info';
import { isSupabaseConfigured, isMockAuthAllowed, isValidUuid, AUTH_CONFIG } from '@/lib/auth/config';
import { mockAuthManager } from '@/lib/auth/mock';
import { createSupabaseServerClient } from '@/lib/auth/server';

export interface AdminOverview {
  health: {
    status: 'healthy' | 'degraded' | 'offline';
    apiUptime: boolean;
    storageConnected: boolean;
    storageProvider: string;
    checkedAt: string;
  };
  deployment: {
    buildId: string;
    environment: string;
    deployedAt: string;
    vercelEnv?: string;
  };
  f1: {
    season: string;
    lastSyncTime?: string;
    upstreamSyncSuccess?: boolean;
    isStale?: boolean;
    syncCutoffDesc?: string;
    errorMessage?: string;
  };
}

export interface AdminUserItem {
  id: string;
  email: string;
  isVerified: boolean;
  provider: string;
  role: string;
  createdAt: string;
}

export interface AdminAIMetrics {
  totalRequests: number;
  rateLimitHits: number;
  estimatedTokens: number;
  provider: string;
  isConfigured: boolean;
  lastActiveTime?: string;
}

// 内存单例用于本地审计与冷却控制
let lastSyncTimestamp = 0;
const SYNC_COOLDOWN_MS = 30 * 1000; // 30 秒冷却防刷保护

export async function getAdminOverview(): Promise<AdminOverview> {
  const overview = await defaultF1Service.getOverview().catch(() => null);
  const storageInfo = getStorageInfo();

  return {
    health: {
      status: overview ? 'healthy' : 'degraded',
      apiUptime: true,
      storageConnected: storageInfo.connected,
      storageProvider: storageInfo.detail || storageInfo.provider,
      checkedAt: new Date().toISOString()
    },
    deployment: {
      buildId: BUILD_ID,
      environment: BUILD_ENV,
      deployedAt: BUILD_TIMESTAMP,
      vercelEnv: process.env.VERCEL_ENV || 'production'
    },
    f1: {
      season: overview?.season || '2026',
      lastSyncTime: overview?.updatedAt || overview?.respondedAt,
      upstreamSyncSuccess: overview?.upstreamSyncSuccess,
      isStale: overview?.isStale,
      syncCutoffDesc: overview?.standingsCutoffDesc,
      errorMessage: overview?.upstreamSyncSuccess === false ? '上游 Jolpica 服务连接重试已降级至 LKG 离线快照' : undefined
    }
  };
}

export async function getAdminUsers(): Promise<{ total: number; users: AdminUserItem[] }> {
  // 1. 如果配置了 Supabase Service Role Key
  if (isSupabaseConfigured() && AUTH_CONFIG.supabaseServiceRoleKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabaseServiceRoleKey);
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();
      if (!error && data?.users) {
        const users = data.users.map(u => ({
          id: u.id,
          email: u.email || '未绑定邮箱',
          isVerified: Boolean(u.email_confirmed_at),
          provider: (u.app_metadata?.provider as string) || (u.app_metadata?.providers?.[0] as string) || 'email',
          role: (AUTH_CONFIG.adminUserId && isValidUuid(AUTH_CONFIG.adminUserId) && u.id === AUTH_CONFIG.adminUserId) ? '专属管理员' : '普通用户',
          createdAt: u.created_at
        }));
        return { total: users.length, users };
      }
    } catch (e) {
      console.warn('[Admin Service] Supabase listUsers error:', e);
    }
  }

  // 生产环境下禁止返回任何 Mock 用户数据
  if (!isMockAuthAllowed()) {
    return { total: 0, users: [] };
  }

  // 2. 本地测试 Mock 数据源
  const mockUsers = mockAuthManager.getAllUsers().map(u => ({
    id: u.id,
    email: u.email,
    isVerified: Boolean(u.email_confirmed_at),
    provider: u.app_metadata?.providers?.[0] || 'email',
    role: (AUTH_CONFIG.adminUserId && isValidUuid(AUTH_CONFIG.adminUserId) && u.id === AUTH_CONFIG.adminUserId) ? '专属管理员' : '普通用户',
    createdAt: u.created_at
  }));

  return { total: mockUsers.length, users: mockUsers };
}

export async function recordAIRateLimitHit(): Promise<void> {
  try {
    const cache = getCacheStore();
    const hits = (await cache.get<number>('stats:ai:rate_limit_hits')) || 0;
    await cache.set('stats:ai:rate_limit_hits', hits + 1);
  } catch (_) {}
}

export async function recordAIRequestStart(): Promise<void> {
  try {
    const cache = getCacheStore();
    const total = (await cache.get<number>('stats:ai:total_requests')) || 0;
    await cache.set('stats:ai:total_requests', total + 1);
    await cache.set('stats:ai:last_request_time', new Date().toISOString());
  } catch (_) {}
}

export async function recordAITokenUsage(tokens: number): Promise<void> {
  try {
    if (tokens <= 0) return;
    const cache = getCacheStore();
    const current = (await cache.get<number>('stats:ai:tokens_estimated')) || 0;
    await cache.set('stats:ai:tokens_estimated', current + tokens);
  } catch (_) {}
}

export async function getAdminAIMetrics(): Promise<AdminAIMetrics> {
  const cache = getCacheStore();
  const total = await cache.get<number>('stats:ai:total_requests') || 0;
  const rateLimitHits = await cache.get<number>('stats:ai:rate_limit_hits') || 0;
  const tokenCount = await cache.get<number>('stats:ai:tokens_estimated') || 0;
  const lastActive = await cache.get<string>('stats:ai:last_request_time');

  const hasKey = Boolean(process.env.DEEPSEEK_API_KEY);

  return {
    totalRequests: total,
    rateLimitHits,
    estimatedTokens: tokenCount,
    provider: process.env.AI_PROVIDER || 'deepseek',
    isConfigured: hasKey,
    lastActiveTime: lastActive || undefined
  };
}

export async function executeAdminF1Sync(): Promise<{ success: boolean; message: string; cooldownRemaining?: number; details?: any }> {
  const now = Date.now();
  if (now - lastSyncTimestamp < SYNC_COOLDOWN_MS) {
    const remainingSec = Math.ceil((SYNC_COOLDOWN_MS - (now - lastSyncTimestamp)) / 1000);
    return {
      success: false,
      message: `操作过于频繁，请等待 ${remainingSec} 秒冷却后再触发同步`,
      cooldownRemaining: remainingSec
    };
  }

  lastSyncTimestamp = now;

  try {
    const season = '2026';
    const operations = [
      ['calendar', () => defaultF1Service.getCalendarResult(season, true)],
      ['drivers', () => defaultF1Service.getDriverStandingsResult(season, true)],
      ['constructors', () => defaultF1Service.getConstructorStandingsResult(season, true)],
      ['lastResult', () => defaultF1Service.getLastRaceResultResult(season, true)]
    ] as const;

    const completed = await Promise.allSettled(operations.map(([, run]) => run()));
    const summary = Object.fromEntries(
      completed.map((result, i) => [
        operations[i][0],
        result.status === 'fulfilled'
          ? { success: result.value.source === 'live', source: result.value.source, updatedAt: result.value.fetchedAt }
          : { success: false, reason: 'Sync failed' }
      ])
    );

    const isAllOk = Object.values(summary).every(r => r.success);

    return {
      success: true,
      message: isAllOk ? '全量 2026 赛季数据同步完成' : '部分上游数据已同步，其余采用已有快照安全保障',
      details: {
        feishuNotificationSuppressed: true, // 严禁触发任何飞书提醒
        summary
      }
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || '执行数据同步时发生异常'
    };
  }
}
