import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { Readable } from 'node:stream';
import { isIP } from 'node:net';
import { checkUrlSafety } from './url_safety';

/** Resolve once inside the connection's lookup. TLS and Host retain the original hostname. */
export function createPinnedLookup(resolve = lookup) {
  return (hostname: string, options: any, callback: (...args: any[]) => void) => {
    resolve(hostname, {all:true}).then(records => {
      if (!records.length || records.some(r => !isIP(r.address) || !checkUrlSafety(`http://${r.family===6?'['+r.address+']':r.address}/`).safe)) {
        callback(new Error('ssrf_blocked_dns_address')); return;
      }
      const selected = records.find(r => !options.family || r.family === options.family) || records[0];
      if (options.all) callback(null, [selected]);
      else callback(null, selected.address, selected.family);
    }, error => callback(error));
  };
}

export function pinnedRequest(url: string, signal: AbortSignal, headers: Record<string,string>): Promise<Response> {
  const target = new URL(url);
  if (!checkUrlSafety(url).safe) return Promise.reject(new Error('unsafe_target'));
  return new Promise((resolve, reject) => {
    const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
      signal, headers, agent:false, lookup:createPinnedLookup(),
    }, response => {
      try {
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value) responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const status=response.statusCode || 502;
      const body=[204,205,304].includes(status)?null:Readable.toWeb(response) as ReadableStream<Uint8Array>;
      if(!body)response.resume();
      resolve(new Response(body, {status, headers:responseHeaders}));
      }catch(error){response.destroy();reject(error);}
    });
    request.on('error', reject);
    request.end();
  });
}
