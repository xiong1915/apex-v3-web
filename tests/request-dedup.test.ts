import test from 'node:test';
import assert from 'node:assert/strict';
import { F1Service } from '../providers/f1/service';
import { MemoryCacheStore } from '../lib/storage';
import { LastKnownGoodStore } from '../lib/storage/lkg';

const payload = {MRData:{RaceTable:{Races:[{season:'2026',round:'1',raceName:'Test GP',date:'2026-03-08',
  time:'04:00:00Z',Circuit:{circuitId:'albert_park',circuitName:'Albert Park',Location:{country:'Australia',locality:'Melbourne'}}}]}}};

test('concurrent public calendar reads share one upstream request', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 15));
    return Response.json(payload);
  });
  const cache = new MemoryCacheStore();
  const service = new F1Service(cache, new LastKnownGoodStore(cache, ''));
  const results = await Promise.all(Array.from({length:8}, () => service.getCalendar('2026')));
  assert.equal(calls, 1);
  assert.ok(results.every(result => result[0].circuitId === 'albert_park'));
});

test('a failed request is released so a later call can recover', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++calls === 1) throw new Error('Offline');
    return Response.json(payload);
  });
  const cache = new MemoryCacheStore();
  const service = new F1Service(cache, new LastKnownGoodStore(cache, ''));
  assert.deepEqual(await service.getCalendar('2026'), []);
  assert.equal((await service.getCalendar('2026')).length, 1);
  assert.equal(calls, 2);
});
