'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ChatTurn, Conversation, ConversationSummary } from './conversation-types';
import { chatFingerprint } from './chat-context';

async function request(owner: string, path: string, method = 'GET', body?: unknown) {
 if (!owner) throw new Error('请重新验证登录状态');
 const controller = new AbortController();
 const timer = method === 'GET' ? setTimeout(() => controller.abort(), 12000) : null;
 try {
  const response = await fetch('/api/ai/conversations' + path, { method, cache: 'no-store', headers: { 'x-apex-history-owner': owner, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, ...(timer ? {signal: controller.signal} : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '云端历史操作失败');
  return data;
 } catch (error) {
  if (controller.signal.aborted) throw new Error('历史对话读取超时，请重试；当前输入已保留');
  throw error;
 } finally { if (timer) clearTimeout(timer); }
}
export function useConversationHistory(enabled: boolean, messages: ChatTurn[], setMessages: (messages: ChatTurn[]) => void, generating: boolean, generationLock?: { current: boolean }, owner = '') {
 const currentOwner = useRef(owner); currentOwner.current = owner;
 const requestForOwner = useCallback(async (path: string, method = 'GET', body?: unknown) => {
  if (currentOwner.current !== owner) throw new Error('账号已变化，请刷新后重试');
  const data = await request(owner, path, method, body);
  if (currentOwner.current !== owner) throw new Error('账号已变化，请刷新后重试');
  return data;
 }, [owner]);
 const [items, setItems] = useState<ConversationSummary[]>([]);
 const [activeId, setActiveId] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);
 const [ready, setReady] = useState(false);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [saveError, setSaveError] = useState<string | null>(null);
 const fingerprint = useMemo(() => chatFingerprint(messages), [messages]);
 const active = useRef<Conversation | null>(null);
 const saved = useRef('[]');
 const draftId = useRef<string | null>(null);
 const contextVersion = useRef(0);
 const operationLock = useRef(false);
 const saveSequence = useRef(0);
 const inFlight = useRef<Promise<boolean> | null>(null);
 const isBusy = useCallback(() => operationLock.current || Boolean(inFlight.current), []);
 const enabledRef = useRef(enabled); enabledRef.current = enabled;
 const remember = useCallback((c: Conversation) => {
  active.current = c; saved.current = chatFingerprint(c.messages); setActiveId(c.id);
  const { messages: turns, ...rest } = c;
  setItems(prev => [{ ...rest, messageCount: turns.length }, ...prev.filter(item => item.id !== c.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
 }, []);
 const refresh = useCallback(async () => {
  const version = contextVersion.current;
  setLoading(true);
  try { const data = await requestForOwner(''); if (version !== contextVersion.current) return; setItems(data.conversations); setError(null); }
  catch (e) { if (version === contextVersion.current) setError(e instanceof Error ? e.message : '历史列表加载失败'); }
  finally { if (version === contextVersion.current) { setLoading(false); setReady(true); } }
 }, [requestForOwner]);
 useEffect(() => {
  contextVersion.current++; saveSequence.current++; active.current = null; saved.current = '[]'; draftId.current = null;
  setItems([]); setActiveId(null); setReady(false); setError(null); setSaveError(null);
 }, [owner]);
 useEffect(() => { if (enabled && owner) void refresh(); }, [enabled, owner, refresh]);
 const save = useCallback(async function save(turns: ChatTurn[]): Promise<boolean> {
  const sequence = ++saveSequence.current;
  const version = contextVersion.current;
  if (!enabledRef.current || !turns.length || chatFingerprint(turns) === saved.current) return true;
  if (inFlight.current) {
   await inFlight.current;
   if (sequence !== saveSequence.current || version !== contextVersion.current) return false;
   if (chatFingerprint(turns) === saved.current) return true;
  }
  setSaving(true);
  const task = (async () => {
   try {
    const current = active.current;
    const data = current
     ? await requestForOwner('?id=' + current.id, 'PUT', { revision: current.revision, messages: turns })
     : await requestForOwner('', 'POST', { id: draftId.current ||= crypto.randomUUID(), messages: turns });
    if (version !== contextVersion.current) return false;
    remember(data.conversation); setSaveError(null); return true;
   } catch (e) { setSaveError(e instanceof Error ? e.message : '保存失败，当前内容尚未保存'); return false; }
   finally { setSaving(false); inFlight.current = null; }
  })();
  inFlight.current = task; return task;
 }, [remember, requestForOwner]);
 useEffect(() => { if (enabled && !generating) void save(messages); }, [enabled, generating, messages, save]);
 const select = async (id: string) => {
  if (generating || generationLock?.current || saving || operationLock.current) return;
  operationLock.current = true;
  if (!(await save(messages))) { operationLock.current = false; return; }
  contextVersion.current++;
  setLoading(true);
  try { const data = await requestForOwner('?id=' + id); if (!enabledRef.current) return; remember(data.conversation); setMessages(data.conversation.messages); setError(null); }
  catch (e) { setError(e instanceof Error ? e.message : '打开对话失败'); }
  finally { setLoading(false); operationLock.current = false; }
 };
 const startNew = async () => {
  if (generating || generationLock?.current || saving || operationLock.current) return;
  operationLock.current = true;
  if (!(await save(messages))) { operationLock.current = false; return; }
  contextVersion.current++; draftId.current = null;
  active.current = null; saved.current = '[]'; setActiveId(null); setMessages([]); setError(null); setSaveError(null);
  operationLock.current = false;
 };
 const saveAsNew = async () => {
  if (generating || generationLock?.current || saving || inFlight.current || operationLock.current || !messages.length) return;
  operationLock.current = true;
  setSaving(true);
  const id = crypto.randomUUID();
  try { const data = await requestForOwner('', 'POST', { id, messages }); draftId.current = id; contextVersion.current++; remember(data.conversation); setSaveError(null); setError(null); }
  catch (e) { setSaveError(e instanceof Error ? e.message : '另存失败，当前内容仍未保存'); }
  finally { setSaving(false); operationLock.current = false; }
 };
 const downloadDraft = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ title: active.current?.title || '未保存对话', messages }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'apex-chat-draft.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 };
 const rename = async (item: ConversationSummary, title: string) => {
  if (generating || generationLock?.current || saving || !(await save(messages))) return;
  try {
   const revision = active.current?.id === item.id ? active.current.revision : item.revision;
   const data = await requestForOwner('?id=' + item.id, 'PUT', { revision, title });
   if (active.current?.id === item.id) remember(data.conversation);
   await refresh();
  } catch (e) { setError(e instanceof Error ? e.message : '重命名失败'); }
 };
 const remove = async (item: ConversationSummary) => {
  if (generating || generationLock?.current || saving || loading || operationLock.current) return;
  operationLock.current = true;
  try {
   await requestForOwner('?id=' + item.id, 'DELETE', { revision: item.revision });
   if (active.current?.id === item.id) { contextVersion.current++; draftId.current = null; active.current = null; saved.current = '[]'; setActiveId(null); setMessages([]); setSaveError(null); }
   await refresh();
  } catch (e) { setError(e instanceof Error ? e.message : '删除失败'); }
  finally { operationLock.current = false; }
 };
 return { items, activeId, ready, isBusy, loading, saving, error: saveError || error, saveError, hasUnsaved: fingerprint !== saved.current, save, refresh, select, startNew, saveAsNew, downloadDraft, rename, remove };
}
export type ConversationHistory = ReturnType<typeof useConversationHistory>;
