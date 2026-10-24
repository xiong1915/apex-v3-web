import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinnedLookup } from '../lib/search/pinned-request';
test('connection lookup pins checked public address and blocks a changed private answer',async()=>{
  let count=0;
  const resolve=async()=>[{address:++count===1?'93.184.216.34':'127.0.0.1',family:4}];
  const lookup=createPinnedLookup(resolve as any);
  const first=await new Promise<any[]>((ok,no)=>lookup('example.com',{},(e,...r)=>e?no(e):ok(r)));
  assert.deepEqual(first,['93.184.216.34',4]); assert.equal(count,1);
  await assert.rejects(new Promise((ok,no)=>lookup('example.com',{},(e,...r)=>e?no(e):ok(r))),/ssrf_blocked/);
});
test('mixed public and private DNS answers are rejected',async()=>{
  const lookup=createPinnedLookup((async()=>[{address:'93.184.216.34',family:4},{address:'::1',family:6}]) as any);
  await assert.rejects(new Promise((ok,no)=>lookup('example.com',{all:true},(e,...r)=>e?no(e):ok(r))),/ssrf_blocked/);
});
