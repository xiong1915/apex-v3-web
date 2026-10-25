// lib/admin/service.ts
// APEX Control 私人后台业务中枢 (聚合真实系统数据、用户、AI监控及 F1 调度)

import { defaultF1Service } from '@/providers/f1/service';
import { getStorageInfo, getCacheStore } from '@/lib/storage';
import { BUILD_ID, BUILD_ENV, BUILD_TIMESTAMP } from '@/lib/build-info';
import { isSupabaseConfigured, isMockAuthAllowed, isValidUuid, AUTH_CONFIG } from '@/lib/auth/config';
import { mockAuthManager } from '@/lib/auth/mock';
import { providerConfiguration, readAIMonitor } from './ai-monitor';

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
  model: string;
  monitoring: Awaited<ReturnType<typeof readAIMonitor>>;
  limits: { hourly: number; perMinute: number; requestTimeoutSeconds: number };
  historyStorageConfigured: boolean;
}

// 内存单例用于本地审计与冷却控制
let lastSyncTimestamp = 0;
const SYNC_COOLDOWN_MS = 30 * 1000; // 30 秒冷却防刷保护

export async function getAdminOverview(): Promise<AdminOverview> {
  const storageInfo = getStorageInfo();
  const cache = getCacheStore();
  const [f1Result, storageResult] = await Promise.allSettled([
    defaultF1Service.getOverview(),
    cache.getStrict ? cache.getStrict('stats:ai:last_request_time') : cache.get('stats:ai:last_request_time'),
  ]);
  const overview = f1Result.status === 'fulfilled' ? f1Result.value : null;
  const storageConnected = storageResult.status === 'fulfilled';
  const f1Available = overview && overview.dataSource !== 'unavailable';
  const healthy = f1Available && storageConnected && !overview.isStale && overview.dataSource !== 'lkg' && overview.upstreamSyncSuccess === true;

  return {
    health: {
      status: !f1Available ? 'offline' : healthy ? 'healthy' : 'degraded',
      apiUptime: true,
      storageConnected,
      storageProvider: storageInfo.detail || storageInfo.provider,
      checkedAt: new Date().toISOString()
    },
    deployment: {
      buildId: BUILD_ID,
      environment: BUILD_ENV,
      deployedAt: BUILD_TIMESTAMP,
      vercelEnv: process.env.VERCEL_ENV || BUILD_ENV
    },
    f1: {
      season: overview?.season || '2026',
      lastSyncTime: overview?.updatedAt || overview?.respondedAt,
      upstreamSyncSuccess: overview?.upstreamSyncSuccess,
      isStale: overview?.isStale,
      syncCutoffDesc: overview?.standingsCutoffDesc,
      errorMessage: !f1Available ? '赛事数据当前不可用' : overview?.upstreamSyncSuccess === false ? '最近上游同步未成功，请检查数据来源和更新时间' : overview?.isStale || overview?.dataSource === 'lkg' ? '当前使用历史快照，请核对更新时间' : undefined
    }
  };
}

export async function getAdminUsers(): Promise<{ total: number; users: AdminUserItem[] }> {
  // 1. 如果配置了 Supabase Service Role Key
  if (isSupabaseConfigured() && AUTH_CONFIG.supabaseServiceRoleKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabaseServiceRoleKey);
      const allUsers = new Map<string, AdminUserItem>();
      const perPage = 200;
      for (let page = 1; ; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error || !Array.isArray(data?.users)) throw new Error('用户目录暂不可用');
        const users = data.users.map(u => ({
          id: u.id,
          email: u.email || '未绑定邮箱',
          isVerified: Boolean(u.email_confirmed_at),
          provider: (u.app_metadata?.provider as string) || (u.app_metadata?.providers?.[0] as string) || 'email',
          role: (AUTH_CONFIG.adminUserId && isValidUuid(AUTH_CONFIG.adminUserId) && u.id === AUTH_CONFIG.adminUserId) ? '专属管理员' : '普通用户',
          createdAt: u.created_at
        }));
        const previousCount = allUsers.size;
        users.forEach(u => allUsers.set(u.id, u));
        if (data.users.length < perPage) return { total: allUsers.size, users: [...allUsers.values()] };
        if (allUsers.size === previousCount || page >= 1000) throw new Error('用户目录分页异常');
      }
    } catch (e) {
      throw new Error('用户目录暂不可用，请稍后重试');
    }
  }

  // 生产环境下禁止返回任何 Mock 用户数据
  if (!isMockAuthAllowed()) {
    throw new Error('用户管理服务未配置，暂不可用');
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
    if(cache.incrementCounters){await cache.incrementCounters({'stats:ai:rate_limit_hits':1});return;}
    const hits = (await cache.get<number>('stats:ai:rate_limit_hits')) || 0;
    await cache.set('stats:ai:rate_limit_hits', hits + 1);
  } catch (_) {}
}

export async function recordAIRequestStart(): Promise<void> {
  try {
    const cache = getCacheStore();
    if(cache.incrementCounters){await cache.incrementCounters({'stats:ai:total_requests':1},new Date().toISOString());return;}
    const total = (await cache.get<number>('stats:ai:total_requests')) || 0;
    await cache.set('stats:ai:total_requests', total + 1);
    await cache.set('stats:ai:last_request_time', new Date().toISOString());
  } catch (_) {}
}

export async function recordAITokenUsage(tokens: number): Promise<void> {
  try {
    if (tokens <= 0) return;
    const cache = getCacheStore();
    if(cache.incrementCounters){await cache.incrementCounters({'stats:ai:tokens_estimated':Math.ceil(tokens)});return;}
    const current = (await cache.get<number>('stats:ai:tokens_estimated')) || 0;
    await cache.set('stats:ai:tokens_estimated', current + tokens);
  } catch (_) {}
}

export async function getAdminAIMetrics(): Promise<AdminAIMetrics> {
  const cache = getCacheStore();
  const read = <T,>(key: string) => cache.getStrict ? cache.getStrict<T>(key) : cache.get<T>(key);
  const [total, rateLimitHits, tokenCount, lastActive, monitoring] = await Promise.all([
    read<number>('stats:ai:total_requests'),
    read<number>('stats:ai:rate_limit_hits'),
    read<number>('stats:ai:tokens_estimated'),
    read<string>('stats:ai:last_request_time'),
    readAIMonitor(),
  ]);
  if (!monitoring.available) throw new Error('AI 监控存储暂不可用');

  return {
    totalRequests: total ?? 0,
    rateLimitHits: rateLimitHits ?? 0,
    estimatedTokens: tokenCount ?? 0,
    ...providerConfiguration(),
    monitoring,
    limits: { hourly: 600, perMinute: 15, requestTimeoutSeconds: 25 },
    historyStorageConfigured: Boolean((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN) && process.env.STORAGE_PROVIDER !== 'memory'),
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
