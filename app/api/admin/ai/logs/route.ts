// app/api/admin/ai/logs/route.ts
// APEX Control 私人管理后台 AI 对话记录与审计查询接口

import { NextRequest } from 'next/server';
import { adminAccess, adminJson } from '../../_security';
import { getAdminAIChatLogs } from '@/lib/admin/ai-chat-logs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await adminAccess(req);
    if (!auth.ok) return adminJson({ error: auth.message }, auth.status);

    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId')?.trim() || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const data = await getAdminAIChatLogs({ userId, limit, offset });
    return adminJson(data);
  } catch (error: any) {
    console.error('[Admin AI Logs API] Error:', error);
    return adminJson({ error: 'AI 对话审计记录读取失败，请稍后重试' }, 503);
  }
}
