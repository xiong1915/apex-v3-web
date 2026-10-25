import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { getConversationService } from '@/lib/ai/conversation-store';
import { HistoryError, messagesSchema, updateConversationSchema, ConversationService } from '@/lib/ai/conversations';
import { z } from 'zod';
const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie, Authorization' };
export async function handleConversationRequest(req: NextRequest, method: string, dependencies: { getUser: typeof getServerUser; getService: () => ConversationService } = { getUser: getServerUser, getService: getConversationService }) {
 try {
  const user = await dependencies.getUser(req);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401, headers });
  const expectedOwner = req.headers.get('x-apex-history-owner');
  if (expectedOwner && expectedOwner !== user.id) return NextResponse.json({error:'账号已变化，请刷新后重试'}, {status:409,headers});
  // Mutations only accept the same origin. No client-supplied owner ID is used.
  const origin = req.headers.get('origin');
  if (method !== 'GET' && origin && ![req.nextUrl.origin, 'https://f1.tike69.cc.cd'].includes(origin)) return NextResponse.json({ error: '请求来源不匹配' }, { status: 403, headers });
  const service = dependencies.getService();
  const rawId = req.nextUrl.searchParams.get('id');
  const id = rawId ? z.uuid().parse(rawId) : null;
  if (method === 'GET') return NextResponse.json(id ? { conversation: await service.read(user.id, id) } : { conversations: await service.list(user.id) }, { headers });
  if (Number(req.headers.get('content-length') || 0) > 250000) throw new HistoryError('对话内容过大，请新建对话', 413);
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  if (reader) try {
   while (true) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 250000) { await reader.cancel(); throw new HistoryError('对话内容过大，请新建对话', 413); }
    chunks.push(value);
   }
  } finally { reader.releaseLock(); }
  const raw = Buffer.concat(chunks).toString('utf8');
  const body = JSON.parse(raw);
  if (method === 'POST') {
   const { messages, id } = z.object({ messages: messagesSchema.default([]), id: z.uuid().optional() }).strict().parse(body);
   return NextResponse.json({ conversation: await service.create(user.id, messages, id) }, { status: 201, headers });
  }
  if (!id) throw new HistoryError('缺少对话标识');
  if (method === 'PUT') return NextResponse.json({ conversation: await service.update(user.id, id, updateConversationSchema.parse(body)) }, { headers });
  const { revision } = z.object({ revision: z.number().int().positive() }).strict().parse(body);
  await service.remove(user.id, id, revision);
  return NextResponse.json({ deleted: true }, { headers });
 } catch (error) {
  const status = error instanceof HistoryError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503;
  const message = error instanceof HistoryError ? error.message : status === 400 ? '对话格式无效或超过保存限制' : '云端历史暂不可用，请稍后重试；未保存的内容请勿关闭';
  return NextResponse.json({ error: message }, { status, headers });
 }
}
