// app/api/profile/route.ts
// APEX V3 APEX ID 个人资料读取与更新接口
// 强制服务端会话校验，私有缓存隔离，防跨用户越权与恶意参数注入

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { getUserProfile, updateUserProfile } from '@/lib/profile/service';
import { defaultRateLimitStore } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user) {
      return NextResponse.json({ error: '请先登录' }, {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }

    const profile = await getUserProfile(session.user);

    return NextResponse.json({ profile }, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  } catch (err: any) {
    console.error('[API /api/profile GET] Error:', err);
    return NextResponse.json({ error: '获取个人资料失败，请稍后重试' }, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user) {
      return NextResponse.json({ error: '请先登录' }, {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }

    // 频率限制防刷保护 (每用户每分钟最多允许 30 次更新)
    const rateKey = `rate:profile:${session.user.id}`;
    const rateCheck = await defaultRateLimitStore.checkRateLimit(rateKey, 30, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: '操作过于频繁，请稍候再试' }, {
        status: 429,
        headers: {
          'Cache-Control': 'private, no-store',
          'Retry-After': String(Math.max(1, rateCheck.resetAt - Math.floor(Date.now() / 1000)))
        }
      });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '无效的请求体' }, {
        status: 400,
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }

    // 安全边界：仅提取允许用户自行修改的字段，坚决杜绝 role、admin、mfa 等越权参数
    const updates: { display_name?: string; favorite_team_ids?: string[] } = {};
    if ('display_name' in body) updates.display_name = body.display_name;
    if ('favorite_team_ids' in body) updates.favorite_team_ids = body.favorite_team_ids;

    const result = await updateUserProfile(session.user, updates);
    if (result.error) {
      return NextResponse.json({ error: result.error, profile: result.profile }, {
        status: 400,
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }

    return NextResponse.json({ profile: result.profile }, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  } catch (err: any) {
    console.error('[API /api/profile PATCH] Error:', err);
    return NextResponse.json({ error: '更新个人资料失败，请稍后重试' }, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
}
