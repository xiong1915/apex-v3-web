// app/api/admin/overview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/server';
import { getAdminOverview } from '@/lib/admin/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      {
        status: auth.status,
        headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' }
      }
    );
  }

  const data = await getAdminOverview();
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, no-cache, no-store, must-revalidate'
    }
  });
}
