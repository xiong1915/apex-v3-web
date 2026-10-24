import test from 'node:test';
import assert from 'node:assert/strict';
import { ReplayWindowLoader } from '../lib/f1/replay/window-loader';
test('prefetch and foreground share pending request and cached frames',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({frames:[]});});
  const loader=new ReplayWindowLoader();
  const a=loader.load(1,60),b=loader.load(1,60);
  assert.equal(a,b);await Promise.all([a,b]);await loader.load(1,60);
  assert.equal(calls,1);loader.dispose();
});
