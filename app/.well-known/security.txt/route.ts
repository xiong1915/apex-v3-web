import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  const body = [
    'Contact: mailto:security@tike69.cc.cd',
    'Expires: 2027-12-31T23:59:59.000Z',
    'Preferred-Languages: zh, en',
    'Canonical: https://f1.tike69.cc.cd/.well-known/security.txt',
    'Policy: https://f1.tike69.cc.cd/security',
    'Acknowledgments: https://f1.tike69.cc.cd/security#hall-of-fame',
    ''
  ].join('\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
