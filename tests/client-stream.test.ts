import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeAIStream } from '../lib/ai/client-stream';

function stream(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({start(controller) {
    chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
    controller.close();
  }});
}

test('AI stream preserves split events and a final event without newline', async () => {
  const events: unknown[] = [];
  await consumeAIStream(stream('data: {"type":"del', 'ta","content":"你好"}\r\n\r\n',
    'data: {"type":"sources","sources":[]}\n\ndata: {"type":"done"}'), event => events.push(event));
  assert.deepEqual(events, [{type:'delta',content:'你好'}, {type:'sources',sources:[]}, {type:'done'}]);
});

test('AI stream rejects a truncated answer without a completion marker', async () => {
  await assert.rejects(consumeAIStream(stream('data: {"type":"delta","content":"截断内容"}\n\n'), () => {}), /提前结束/);
});

test('AI stream surfaces server errors instead of recording successful completion', async () => {
  await assert.rejects(consumeAIStream(stream('data: {"type":"error","error":"服务暂不可用"}\n\n'), () => {}), /服务暂不可用/);
});

test('AI stream stops at DONE and cancels its reader', async () => {
  let cancelled = false;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({start(controller) {
    controller.enqueue(encoder.encode('data: {"type":"delta","content":"完成"}\n\ndata: [DONE]\n\ndata: {"type":"error"}\n'));
  }, cancel() { cancelled = true; }});
  const events: unknown[] = [];
  await consumeAIStream(body, event => events.push(event));
  assert.equal(events.length, 1);
  assert.equal(cancelled, true);
});

test('AI stream abort cancels pending reads and never emits later content', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({cancel() { cancelled = true; }});
  const result = consumeAIStream(body, () => assert.fail('No event after abort'), controller.signal);
  controller.abort();
  await assert.rejects(result, {name:'AbortError'});
  assert.equal(cancelled, true);
});
