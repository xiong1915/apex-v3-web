// app/api/profile/avatar/route.ts
// APEX V3 用户头像上传与删除管理端点
// 包含严格的文件体积限制 (2MB)、Magic Bytes 校验、用户隔离与频率限制

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { uploadUserAvatar, deleteUserAvatar } from '@/lib/profile/service';
import { defaultRateLimitStore } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user) {
      return NextResponse.json({ error: '请先登录' }, {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }

    // 频率限制防恶意上传 (每用户每分钟最多允许 10 次上传)
    const rateKey = `rate:avatar:${session.user.id}`;
    const rateCheck = await defaultRateLimitStore.checkRateLimit(rateKey, 10, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: '头像上传过于频繁，请稍候再试' }, {
        status: 429,
        headers: {
          'Cache-Control': 'private, no-store',
          'Retry-After': String(Math.max(1, rateCheck.resetAt - Math.floor(Date.now() / 1000)))
        }
      });
    }

    let buffer: Buffer | null = null;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData().catch(() => null);
      if (!formData) {
        return NextResponse.json({ error: '解析表单数据失败' }, {
          status: 400,
          headers: { 'Cache-Control': 'private, no-store' }
        });
      }

      const file = (formData.get('file') || formData.get('avatar')) as File | null;
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: '未找到上传的头像图片文件' }, {
          status: 400,
          headers: { 'Cache-Control': 'private, no-store' }
        });
      }

      const arrayBuf = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    } else {
      const arrayBuf = await req.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: '上传的头像内容为空' }, {
        status: 400,
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }

    const result = await uploadUserAvatar(session.user, buffer);
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
    console.error('[API /api/profile/avatar POST] Error:', err);
    return NextResponse.json({ error: '上传头像处理异常，请重试' }, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user) {
      return NextResponse.json({ error: '请先登录' }, {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }

    const result = await deleteUserAvatar(session.user);
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
    console.error('[API /api/profile/avatar DELETE] Error:', err);
    return NextResponse.json({ error: '删除头像失败，请稍后重试' }, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
}
