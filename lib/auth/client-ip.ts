import { isIP } from 'node:net';
export function trustedClientBucket(headers: Headers, vercel = process.env.VERCEL === '1') {
  // CF headers on the publicly reachable origin are not proof of a trusted proxy.
  if(vercel){
    const forwarded=headers.get('x-vercel-forwarded-for') || headers.get('x-forwarded-for');
    const ip=forwarded?.split(',')[0]?.trim();
    if(ip&&isIP(ip))return ip;
  }
  return 'unknown-peer';
}
