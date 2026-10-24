import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekProvider } from '../providers/ai/deepseek';

test('truncated provider stream keeps partial output and reports error, never done', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'));
  const events = [];
  for await (const event of new DeepSeekProvider({apiKey:'offline-test'}).stream({messages:[{role:'user',content:'test'}]})) events.push(event);
  assert.equal(events[0].type, 'delta');
  assert.equal(events.at(-1)?.type, 'error');
  assert.equal(events.some(e => e.type === 'done'), false);
});
test('explicit completion succeeds even without final newline', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}'));
  const events = [];
  for await (const event of new DeepSeekProvider({apiKey:'offline-test'}).stream({messages:[{role:'user',content:'test'}]})) events.push(event);
  assert.deepEqual(events.map(e=>e.type), ['delta','done']);
});
