'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ChatTurn, Conversation, ConversationSummary } from './conversation-types';
import { chatFingerprint } from './chat-context';

async function request(path: string, method = 'GET', body?: unknown) {
 const response = await fetch('/api/ai/conversations' + path, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
 const data = await response.json();
 if (!response.ok) throw new Error(data.error || '云端历史操作失败');
 return data;
}
export function useConversationHistory(enabled: boolean, messages: ChatTurn[], setMessages: (messages: ChatTurn[]) => void, generating: boolean) {
 const [items, setItems] = useState<ConversationSummary[]>([]);
 const [activeId, setActiveId] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [saveError, setSaveError] = useState<string | null>(null);
 const fingerprint = useMemo(() => chatFingerprint(messages), [messages]);
 const active = useRef<Conversation | null>(null);
 const saved = useRef('[]');
 const inFlight = useRef<Promise<boolean> | null>(null);
 const enabledRef = useRef(enabled); enabledRef.current = enabled;
 const remember = useCallback((c: Conversation) => {
  active.current = c; saved.current = chatFingerprint(c.messages); setActiveId(c.id);
  const { messages: turns, ...rest } = c;
  setItems(prev => [{ ...rest, messageCount: turns.length }, ...prev.filter(item => item.id !== c.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
 }, []);
 const refresh = useCallback(async () => {
  setLoading(true);
  try { setItems((await request('')).conversations); setError(null); }
  catch (e) { setError(e instanceof Error ? e.message : '历史列表加载失败'); }
  finally { setLoading(false); }
 }, []);
 useEffect(() => { if (enabled) void refresh(); }, [enabled, refresh]);
 const save = useCallback(async function save(turns: ChatTurn[]): Promise<boolean> {
  if (!enabledRef.current || !turns.length || chatFingerprint(turns) === saved.current) return true;
  if (inFlight.current) { await inFlight.current; return save(turns); }
  setSaving(true);
  const task = (async () => {
   try {
    const current = active.current;
    const data = current
     ? await request('?id=' + current.id, 'PUT', { revision: current.revision, messages: turns })
     : await request('', 'POST', { messages: turns });
    remember(data.conversation); setSaveError(null); return true;
   } catch (e) { setSaveError(e instanceof Error ? e.message : '保存失败，当前内容尚未保存'); return false; }
   finally { setSaving(false); inFlight.current = null; }
  })();
  inFlight.current = task; return task;
 }, [remember]);
 useEffect(() => { if (enabled && !generating) void save(messages); }, [enabled, generating, messages, save]);
 const select = async (id: string) => {
  if (generating || saving || !(await save(messages))) return;
  setLoading(true);
  try { const data = await request('?id=' + id); remember(data.conversation); setMessages(data.conversation.messages); setError(null); }
  catch (e) { setError(e instanceof Error ? e.message : '打开对话失败'); }
  finally { setLoading(false); }
 };
 const startNew = async () => {
  if (generating || saving || !(await save(messages))) return;
  active.current = null; saved.current = '[]'; setActiveId(null); setMessages([]); setError(null); setSaveError(null);
 };
 const saveAsNew = async () => {
  if (generating || saving || !messages.length) return;
  setSaving(true);
  try { const data = await request('', 'POST', { messages }); remember(data.conversation); setSaveError(null); setError(null); }
  catch (e) { setSaveError(e instanceof Error ? e.message : '另存失败，当前内容仍未保存'); }
  finally { setSaving(false); }
 };
 const downloadDraft = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ title: active.current?.title || '未保存对话', messages }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'apex-chat-draft.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 };
 const rename = async (item: ConversationSummary, title: string) => {
  if (generating || saving || !(await save(messages))) return;
  try {
   const revision = active.current?.id === item.id ? active.current.revision : item.revision;
   const data = await request('?id=' + item.id, 'PUT', { revision, title });
   if (active.current?.id === item.id) remember(data.conversation);
   await refresh();
  } catch (e) { setError(e instanceof Error ? e.message : '重命名失败'); }
 };
 const remove = async (item: ConversationSummary) => {
  if (generating || saving || loading) return;
  try {
   await request('?id=' + item.id, 'DELETE', { revision: item.revision });
   if (active.current?.id === item.id) { active.current = null; saved.current = '[]'; setActiveId(null); setMessages([]); setSaveError(null); }
   await refresh();
  } catch (e) { setError(e instanceof Error ? e.message : '删除失败'); }
 };
 return { items, activeId, loading, saving, error: saveError || error, saveError, hasUnsaved: fingerprint !== saved.current, save, refresh, select, startNew, saveAsNew, downloadDraft, rename, remove };
}
export type ConversationHistory = ReturnType<typeof useConversationHistory>;
