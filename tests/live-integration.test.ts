import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveRedirect } from '../lib/f1/live/links';
import {GET as replayRedirect} from '../app/replay/route';
import {NextRequest} from 'next/server';
import rawWorker from '../cf_worker.js';
const worker = (rawWorker as any).fetch ? rawWorker : (rawWorker as any).default;
test('legacy links preserve valid meeting context without interpreting DEMO or OpenF1 keys as live sessions', () => {
 assert.equal(buildLiveRedirect({season:'2023',round:'1',session:'7953'}), '/live?season=2023&round=1&legacySession=7953');
 assert.equal(buildLiveRedirect({season:'2026',round:'18',session:'race'}), '/live?season=2026&round=18&session=race');
 assert.equal(buildLiveRedirect({season:'javascript:bad',round:'-1',session:'demo-bahrain'}), '/live?legacySession=demo-bahrain');
 assert.equal(buildLiveRedirect({session:['race','sprint']}), '/live');
});
test('legacy route emits an HTTP redirect before any page rendering',()=>{
 const response=replayRedirect(new NextRequest('https://f1.tike69.cc.cd/replay?season=2026&round=18&session=race'));
 assert.equal(response.status,308);
 assert.equal(response.headers.get('location'),'https://f1.tike69.cc.cd/live?season=2026&round=18&session=race');
});
test('Cloudflare upgrade returns the original socket-bearing response instead of reconstructing HTTP', async () => {
 const original=globalThis.fetch;
 const upgraded={status:101,webSocket:{accepted:true},headers:new Headers(),body:null};
 globalThis.fetch=async()=>upgraded as any;
 try {assert.equal(await worker.fetch(new Request('https://f1.tike69.cc.cd/api/f1/live/stream',{headers:{Upgrade:'websocket'}}),{},{}),upgraded);}
 finally {globalThis.fetch=original;}
});
