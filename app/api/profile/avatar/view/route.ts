// app/api/profile/avatar/view/route.ts
// APEX V3 头像读取代理端点 (支持私有桶流式安全输出与内存降级)

import { NextRequest, NextResponse } from 'next/server';
import { getMemoryAvatar } from '@/lib/profile/service';
import { isSupabaseConfigured } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path) {
    return new NextResponse('缺少头像路径参数', { status: 400 });
  }

  // 1. 检查内存降级存储 (测试或离线开发)
  const mem = getMemoryAvatar(path);
  if (mem) {
    return new NextResponse(new Uint8Array(mem.buffer), {
      status: 200,
      headers: {
        'Content-Type': mem.mimeType,
        'Cache-Control': 'private, max-age=3600'
      }
    });
  }

  // 2. Supabase Storage 私有桶读取
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.storage.from('avatars').download(path);

      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const contentType = data.type || 'image/jpeg';
        return new NextResponse(new Uint8Array(arrayBuf), {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, max-age=3600'
          }
        });
      }
    } catch (e: any) {
      console.warn('[Avatar View] Supabase download error:', e?.message);
    }
  }

  return new NextResponse('头像文件不存在或无权访问', { status: 404 });
}
