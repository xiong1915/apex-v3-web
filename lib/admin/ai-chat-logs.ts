// lib/admin/ai-chat-logs.ts
// APEX Control AI 对话审计与详细交互日志中心 (记录每位用户的对话内容、IP地址、耗时与设备信息)

import { isSupabaseConfigured, AUTH_CONFIG } from '@/lib/auth/config';
import { AIMessage } from '@/lib/ai/types';

export interface AIChatLogRecord {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  clientIp: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
  messages: AIMessage[];
  response: string;
  model: string;
  tokensEstimated: number;
  durationMs: number;
  outcome: 'success' | 'error' | 'timeout' | 'cancelled';
  createdAt: string;
}

export interface RecordAIChatLogInput {
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  clientIp: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
  messages: AIMessage[];
  response: string;
  model: string;
  tokensEstimated: number;
  durationMs: number;
  outcome: 'success' | 'error' | 'timeout' | 'cancelled';
}

// 内存缓冲区 (用于离线测试环境与容灾隔离，最多保留 100 条)
const memoryLogBuffer: AIChatLogRecord[] = [];

export function resetMemoryAIChatLogs() {
  memoryLogBuffer.length = 0;
}

export async function recordAIChatLog(input: RecordAIChatLogInput): Promise<void> {
  const now = new Date().toISOString();
  const memoryRecord: AIChatLogRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    userEmail: input.userEmail,
    userDisplayName: input.userDisplayName,
    clientIp: input.clientIp || 'unknown',
    userAgent: input.userAgent,
    deviceInfo: input.deviceInfo,
    messages: input.messages,
    response: input.response,
    model: input.model,
    tokensEstimated: input.tokensEstimated,
    durationMs: input.durationMs,
    outcome: input.outcome,
    createdAt: now
  };

  // 1. 先安全压入内存缓冲区
  memoryLogBuffer.unshift(memoryRecord);
  if (memoryLogBuffer.length > 100) {
    memoryLogBuffer.pop();
  }

  // 2. 生产环境持久化写入 Supabase
  if (isSupabaseConfigured() && AUTH_CONFIG.supabaseServiceRoleKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabaseServiceRoleKey);

      await supabaseAdmin.from('ai_chat_logs').insert({
        user_id: input.userId,
        user_email: input.userEmail,
        user_display_name: input.userDisplayName || null,
        client_ip: input.clientIp || 'unknown',
        user_agent: input.userAgent || null,
        device_info: input.deviceInfo || {},
        messages: input.messages,
        response: input.response,
        model: input.model,
        tokens_estimated: input.tokensEstimated,
        duration_ms: input.durationMs,
        outcome: input.outcome
      });
    } catch (err) {
      console.warn('[AI Audit Log] Failed to persist log to Supabase:', err);
    }
  }
}

export async function getAdminAIChatLogs(params: {
  userId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ total: number; logs: AIChatLogRecord[] }> {
  const limit = Math.min(Math.max(1, params.limit || 50), 200);
  const offset = Math.max(0, params.offset || 0);

  // 1. 如果配置了 Supabase，从 PostgreSQL 查询全量历史
  if (isSupabaseConfigured() && AUTH_CONFIG.supabaseServiceRoleKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabaseServiceRoleKey);

      let query = supabaseAdmin
        .from('ai_chat_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (params.userId) {
        query = query.eq('user_id', params.userId);
      }

      const { data, count, error } = await query.range(offset, offset + limit - 1);

      if (!error && Array.isArray(data)) {
        const logs: AIChatLogRecord[] = data.map(row => ({
          id: row.id,
          userId: row.user_id,
          userEmail: row.user_email || '未绑定邮箱',
          userDisplayName: row.user_display_name || undefined,
          clientIp: row.client_ip || 'unknown',
          userAgent: row.user_agent || undefined,
          deviceInfo: row.device_info || undefined,
          messages: Array.isArray(row.messages) ? row.messages : [],
          response: row.response || '',
          model: row.model || 'deepseek-chat',
          tokensEstimated: row.tokens_estimated ?? 0,
          durationMs: row.duration_ms ?? 0,
          outcome: (row.outcome as AIChatLogRecord['outcome']) || 'success',
          createdAt: row.created_at
        }));

        return {
          total: count ?? logs.length,
          logs
        };
      }
    } catch (e) {
      console.warn('[AI Audit Log] Supabase query error, falling back to memory buffer:', e);
    }
  }

  // 2. 本地测试或容灾回退
  let filtered = memoryLogBuffer;
  if (params.userId) {
    filtered = filtered.filter(l => l.userId === params.userId);
  }

  return {
    total: filtered.length,
    logs: filtered.slice(offset, offset + limit)
  };
}
