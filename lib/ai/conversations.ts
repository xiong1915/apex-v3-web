import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ChatTurn, Conversation, ConversationSummary } from './conversation-types';

const sourceSchema = z.object({ name: z.string().max(160), url: z.string().url().max(2048).refine(v => /^https?:\/\//i.test(v)).optional(), snippet: z.string().max(600).optional() }).strict();
const factSchema = z.object({ type: z.enum(['next_race', 'standings', 'previous_race']), title: z.string().max(200), badge: z.string().max(100).optional(), fields: z.array(z.object({ label: z.string().max(120), value: z.string().max(600) }).strict()).max(20) }).strict();
export const messagesSchema = z.array(z.object({
 id: z.string().min(1).max(100), role: z.enum(['user', 'assistant']), content: z.string().max(8000),
 status: z.enum(['completed', 'streaming', 'error', 'aborted']).optional(), sources: z.array(sourceSchema).max(10).optional(), factCard: factSchema.optional()
}).strict()).max(100);
export const updateConversationSchema = z.object({ revision: z.number().int().positive(), title: z.string().trim().min(1).max(80).optional(), messages: messagesSchema.optional() }).strict();
export class HistoryError extends Error {
 constructor(message: string, public status = 400) { super(message); }
}
export interface ConversationDocument { version: number; conversations: Conversation[] }
export interface ConversationStore {
 read(key: string): Promise<ConversationDocument | null>;
 compareAndSet(key: string, version: number, next: ConversationDocument): Promise<boolean>;
}
export class MemoryConversationStore implements ConversationStore {
 private values = new Map<string, ConversationDocument>();
 async read(key: string) { return structuredClone(this.values.get(key) || null); }
 async compareAndSet(key: string, version: number, next: ConversationDocument) {
  if ((this.values.get(key)?.version || 0) !== version) return false;
  this.values.set(key, structuredClone(next)); return true;
 }
}
export class ConversationService {
 constructor(private store: ConversationStore) {}
 private key(user: string) { return `apex:private-history:v1:${encodeURIComponent(user)}`; }
 private async document(user: string) { return await this.store.read(this.key(user)) || { version: 0, conversations: [] }; }
 async list(user: string): Promise<ConversationSummary[]> {
  return (await this.document(user)).conversations.map(({ messages, ...rest }) => ({ ...rest, messageCount: messages.length })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
 }
 async read(user: string, id: string) {
  const conversation = (await this.document(user)).conversations.find(c => c.id === id);
  if (!conversation) throw new HistoryError('对话不存在或已删除', 404);
  return conversation;
 }
 private async mutate<T>(user: string, change: (doc: ConversationDocument) => T): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
   const doc = await this.document(user); const version = doc.version;
   const result = change(doc); doc.version++;
   if (Buffer.byteLength(JSON.stringify(doc), 'utf8') > 400000) throw new HistoryError('历史记录空间已满，请先删除不需要的对话', 413);
   if (await this.store.compareAndSet(this.key(user), version, doc)) return result;
  }
  throw new HistoryError('另一个窗口正在更新历史，请刷新列表后重试', 409);
 }
 async create(user: string, input: ChatTurn[] = []) {
  const messages = messagesSchema.parse(input);
  return this.mutate(user, doc => {
   if (doc.conversations.length >= 30) throw new HistoryError('最多保存 30 段对话，请先删除不需要的记录', 409);
   const now = new Date().toISOString();
   const c: Conversation = { id: randomUUID(), title: messages.find(m => m.role === 'user')?.content.slice(0, 40) || '新对话', revision: 1, createdAt: now, updatedAt: now, messages };
   doc.conversations.push(c); return c;
  });
 }
 async update(user: string, id: string, input: z.input<typeof updateConversationSchema>) {
  const update = updateConversationSchema.parse(input);
  return this.mutate(user, doc => {
   const c = doc.conversations.find(c => c.id === id);
   if (!c) throw new HistoryError('对话不存在或已删除', 404);
   if (c.revision !== update.revision) throw new HistoryError('另一个窗口已更新这段对话，请重新打开后继续', 409);
   if (update.title !== undefined) c.title = update.title;
   if (update.messages !== undefined) c.messages = update.messages;
   c.revision++; c.updatedAt = new Date().toISOString(); return c;
  });
 }
 async remove(user: string, id: string, revision: number) {
  return this.mutate(user, doc => {
   const c = doc.conversations.find(c => c.id === id);
   if (!c) throw new HistoryError('对话不存在或已删除', 404);
   if (c.revision !== revision) throw new HistoryError('另一个窗口已更新这段对话，请刷新后再删除', 409);
   doc.conversations = doc.conversations.filter(c => c.id !== id);
  });
 }
}
