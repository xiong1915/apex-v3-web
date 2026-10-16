import type { AIStreamEvent } from './types';

/** Read SSE without swallowing application errors or dropping the final line. */
export async function consumeAIStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AIStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const abort = () => { void reader.cancel().catch(() => {}); };
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
  };
  signal?.addEventListener('abort', abort, { once: true });
  function lineEvent(line: string): boolean {
    if (!line.startsWith('data:')) return false;
    const data = line.slice(5).trim();
    if (data === '[DONE]') return true;
    let event: AIStreamEvent;
    try { event = JSON.parse(data); } catch { return false; }
    if (event?.type === 'error') throw new Error(event.error || '模型生成异常');
    if (event && typeof event.type === 'string') onEvent(event);
    return event?.type === 'done';
  }
  try {
    checkAbort();
    while (true) {
      const { done, value } = await reader.read();
      checkAbort();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) if (lineEvent(line)) return;
      if (done) {
        if (buffer && lineEvent(buffer)) return;
        throw new Error('连接提前结束，请重试以获取完整回答');
      }
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
