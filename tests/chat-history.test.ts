import test from 'node:test';
import assert from 'node:assert/strict';
import { ConversationService, MemoryConversationStore } from '../lib/ai/conversations';
import { buildChatContext, chatFingerprint } from '../lib/ai/chat-context';

const turn = { id: 'm1', role: 'user' as const, content: '轮胎策略', status: 'completed' as const };
test('saved content comparison ignores schema serialization key order', () => {
 assert.equal(chatFingerprint([{ ...turn, sources: [{ name: 'test', url: 'https://example.invalid' }] }]), chatFingerprint([{ sources: [{ url: 'https://example.invalid', name: 'test' }], status: 'completed', content: '轮胎策略', role: 'user', id: 'm1' }]));
});
test('cloud histories isolate owners and support create, read, rename, update and delete', async () => {
 const service = new ConversationService(new MemoryConversationStore());
 const created = await service.create('alice', [turn]);
 assert.equal(created.title, '轮胎策略');
 assert.equal((await service.list('bob')).length, 0);
 await assert.rejects(service.read('bob', created.id), /不存在/);
 const updated = await service.update('alice', created.id, { revision: created.revision, title: '我的策略', messages: [turn, { ...turn, id: 'm2', role: 'assistant', content: '根据赛道选择。' }] });
 assert.equal(updated.revision, 2);
 assert.equal((await service.read('alice', created.id)).messages.length, 2);
 await assert.rejects(service.update('alice', created.id, { revision: 1, title: '旧窗口' }), /另一个窗口/);
 await service.remove('alice', created.id, updated.revision);
 assert.equal((await service.list('alice')).length, 0);
});
test('concurrent conversation creation merges rather than losing another conversation', async () => {
 const service = new ConversationService(new MemoryConversationStore());
 await Promise.all([service.create('alice', [turn]), service.create('alice', [{ ...turn, content: '积分榜' }])]);
 assert.equal((await service.list('alice')).length, 2);
});
test('history rejects excessive content and reports storage failures instead of false success', async () => {
 const service = new ConversationService(new MemoryConversationStore());
 await assert.rejects(service.create('alice', [{ ...turn, content: 'x'.repeat(8001) }]));
 const broken = new ConversationService({ read: async () => { throw Error('offline'); }, compareAndSet: async () => false });
 await assert.rejects(broken.list('alice'), /offline/);
});
test('long histories send a bounded recent context while retaining the newest question', () => {
 const history = Array.from({ length: 70 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, content: `${i}:` + 'a'.repeat(1200) }));
 history.push({ role: 'user', content: '最后的问题' });
 const context = buildChatContext(history);
 assert.ok(context.length <= 20);
 assert.ok(context.every(m => m.content.length <= 1000));
 assert.ok(context.reduce((n, m) => n + m.content.length, 0) <= 4000);
 assert.equal(context.at(-1)?.content, '最后的问题');
});
