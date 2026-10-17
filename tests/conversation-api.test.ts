import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { handleConversationRequest } from '../lib/ai/conversation-handler';
import { ConversationService, MemoryConversationStore } from '../lib/ai/conversations';
const req = (method: string, body?: unknown, query = '', origin = 'https://f1.tike69.cc.cd') => new NextRequest('https://deployment.vercel.app/api/ai/conversations' + query, { method, headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
test('history API fails closed anonymously, scopes every operation to the server user, and rejects forged ownership', async () => {
 const service = new ConversationService(new MemoryConversationStore());
 const deps = (id: string) => ({ getUser: async () => ({ id, email: 'test@example.invalid', created_at: '2026-01-01' }), getService: () => service });
 const denied = await handleConversationRequest(req('GET'), 'GET', { getUser: async () => null, getService: () => { throw Error('must not touch storage'); } });
 assert.equal(denied.status, 401);
 const created = await handleConversationRequest(req('POST', { messages: [{ id: 'm1', role: 'user', content: 'test' }] }), 'POST', deps('alice'));
 assert.equal(created.status, 201); assert.match(created.headers.get('cache-control') || '', /no-store/);
 const { conversation } = await created.json();
 for (const method of ['GET', 'PUT', 'DELETE']) {
  const body = method === 'GET' ? undefined : { revision: 1 };
  const other = await handleConversationRequest(req(method, body, '?id=' + conversation.id), method, deps('bob'));
  assert.equal(other.status, 404);
 }
 assert.equal((await handleConversationRequest(req('POST', { ownerId: 'alice', messages: [] }), 'POST', deps('bob'))).status, 400);
 assert.equal((await handleConversationRequest(req('POST', { messages: [] }, '', 'https://evil.invalid'), 'POST', deps('alice'))).status, 403);
});
test('history API does not pretend a failed write succeeded or expose storage errors', async () => {
 const service = new ConversationService({ read: async () => { throw Error('secret=private-key'); }, compareAndSet: async () => false });
 const response = await handleConversationRequest(req('POST', { messages: [] }), 'POST', { getUser: async () => ({ id: 'alice', email: '', created_at: '' }), getService: () => service });
 assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-key|secret=/);
});
