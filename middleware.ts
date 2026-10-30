// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // 本地开发环境跳过源站校验
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    return NextResponse.next();
  }
  // 内部健康检查与 CRON 接口可由特定令牌放行
  if (req.nextUrl.pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }
  const expectedSecret = process.env.ORIGIN_VERIFY_SECRET;
  if (!expectedSecret) {
    return NextResponse.next();
  }
  const incomingSecret = req.headers.get('x-origin-verify-secret');
  if (incomingSecret !== expectedSecret) {
    return new NextResponse('Access Denied: Direct origin access is prohibited.', { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
