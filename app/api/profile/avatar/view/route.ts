// app/api/profile/avatar/view/route.ts
// APEX V3 用户私有头像读取端点
// 强制服务端会话鉴权、严格用户 UUID 隔离、路径遍历防御与安全头防护

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { getMemoryAvatar } from '@/lib/profile/service';
import { isSupabaseConfigured, isProduction } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. 验证用户真实身份 (未登录返回 401)
  const session = await getServerSession(req);
  if (!session || !session.user) {
    return new NextResponse('请先登录', {
      status: 401,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  // 2. 严格防路径遍历与非法字符检查
  if (!path || typeof path !== 'string' || path.trim().length === 0) {
    return new NextResponse('缺少头像路径参数', {
      status: 400,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  const cleanPath = path.trim();
  if (
    cleanPath.includes('..') ||
    cleanPath.includes('\\') ||
    cleanPath.startsWith('/') ||
    cleanPath.includes('//') ||
    /[\u0000-\u001F\u007F]/.test(cleanPath)
  ) {
    return new NextResponse('非法的头像存储路径', {
      status: 400,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  // 3. 严格的用户 UUID 目录隔离 (禁止访问其他用户的目录)
  const pathSegments = cleanPath.split('/');
  if (pathSegments.length !== 2) {
    return new NextResponse('路径层级不合法', {
      status: 400,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  const [dirUserId, fileName] = pathSegments;
  if (dirUserId !== session.user.id) {
    return new NextResponse('权限不足：禁止越权访问其他用户的头像', {
      status: 403,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  // 文件名合法性白名单校验 (如 avatar-123456789.png/jpg/webp)
  if (!/^avatar-\d+\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
    return new NextResponse('头像文件名格式不合法', {
      status: 400,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  // 4. 真实 Supabase Storage 读取
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.storage.from('avatars').download(cleanPath);

      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const contentType = data.type || (fileName.endsWith('.png') ? 'image/png' : fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

        return new NextResponse(new Uint8Array(arrayBuf), {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }

      if (error) {
        console.warn('[Avatar View] Supabase download error:', error.message);
      }
    } catch (e: any) {
      console.warn('[Avatar View] Supabase download exception:', e?.message);
    }
  }

  // 5. 仅限隔离测试环境的内存降级 (生产环境严格禁止)
  if (!isProduction()) {
    const mem = getMemoryAvatar(cleanPath);
    if (mem) {
      return new NextResponse(new Uint8Array(mem.buffer), {
        status: 200,
        headers: {
          'Content-Type': mem.mimeType,
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }
  }

  return new NextResponse('头像文件不存在或无权访问', {
    status: 404,
    headers: {
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
