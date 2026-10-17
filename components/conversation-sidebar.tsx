'use client';
import { useEffect, useRef, useState } from 'react';
import type { ConversationHistory } from '@/lib/ai/use-conversation-history';
import { formatBeijingDisplay } from '@/lib/f1/time';

export function ConversationSidebar({ history, disabled, open, onClose }: { history: ConversationHistory; disabled: boolean; open: boolean; onClose: () => void }) {
 const [search, setSearch] = useState('');
 const [editing, setEditing] = useState<string | null>(null);
 const [title, setTitle] = useState('');
 const [mobile, setMobile] = useState(false);
 const panel = useRef<HTMLElement>(null);
 useEffect(() => { const query = matchMedia('(max-width:1000px)'); const update = () => setMobile(query.matches); update(); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
 useEffect(() => {
  if (!open || !mobile) return;
  const previous = document.activeElement as HTMLElement;
  const content = document.querySelector<HTMLElement>('.ai-chat-console');
  const header = document.querySelector<HTMLElement>('.site-header');
  const priorContent = content?.inert || false, priorHeader = header?.inert || false;
  if (content) content.inert = true; if (header) header.inert = true;
  panel.current?.querySelector<HTMLElement>('button')?.focus();
  const keydown = (e: KeyboardEvent) => {
   if (e.key === 'Escape') onClose();
   if (e.key !== 'Tab') return;
   const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])') || [])];
   const first = controls[0], last = controls.at(-1);
   if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
   else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };
  document.addEventListener('keydown', keydown);
  return () => { if (content) content.inert = priorContent; if (header) header.inert = priorHeader; document.removeEventListener('keydown', keydown); previous?.focus(); };
 }, [open, mobile, onClose]);
 const busy = disabled || history.saving || history.loading;
 return <>{mobile && open && <div className="history-backdrop" onClick={onClose} aria-hidden="true"/>}
 <aside id="conversation-history" className={`conversation-sidebar ${open ? 'is-open' : ''}`} ref={panel} role={mobile && open ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined} aria-label="历史对话">
  <div className="history-heading"><h2>历史对话</h2><button className="history-close btn-secondary" onClick={onClose}>关闭</button></div>
  <button className="btn-primary" disabled={busy} onClick={async () => { await history.startNew(); onClose(); }}>＋ 新建对话</button>
  <label className="sr-only" htmlFor="conversation-search">搜索历史对话</label><input id="conversation-search" placeholder="搜索对话标题" value={search} onChange={e => setSearch(e.target.value)}/>
  <div className="history-list">{history.items.filter(item => item.title.toLowerCase().includes(search.toLowerCase())).map(item => <div className={`history-item ${history.activeId === item.id ? 'is-active' : ''}`} key={item.id}>
   <button className="history-select" disabled={busy} aria-current={history.activeId === item.id ? 'true' : undefined} onClick={async () => { await history.select(item.id); onClose(); }}><strong>{item.title}</strong><small>{formatBeijingDisplay(item.updatedAt)} · {item.messageCount} 条</small></button>
   <div className="history-item-actions"><button disabled={busy} onClick={() => { setEditing(item.id); setTitle(item.title); }} aria-label={`重命名 ${item.title}`}>重命名</button><button disabled={busy} onClick={async () => { if (confirm(history.activeId === item.id && history.hasUnsaved ? '这段对话还有未保存的内容。删除会同时放弃当前未保存内容和云端记录，且无法撤销。确定删除？' : '删除这段云端对话？此操作无法撤销。')) await history.remove(item); }} aria-label={`删除 ${item.title}`}>删除</button></div>
   {editing === item.id && <form onSubmit={async e => { e.preventDefault(); if (title.trim()) { await history.rename(item, title.trim()); setEditing(null); } }}><label className="sr-only" htmlFor={`title-${item.id}`}>对话名称</label><input id={`title-${item.id}`} autoFocus value={title} maxLength={80} onChange={e => setTitle(e.target.value)}/><button disabled={busy || !title.trim()} type="submit">保存名称</button><button type="button" onClick={() => setEditing(null)}>取消</button></form>}
  </div>)}{!history.items.length && !history.loading && <p className="history-empty">还没有已保存的对话。开始提问后会自动保存。</p>}{history.items.length > 0 && !history.items.some(item => item.title.toLowerCase().includes(search.toLowerCase())) && <p className="history-empty">没有匹配的对话</p>}</div>
  <div className="history-footer"><button className="btn-secondary" disabled={busy} onClick={history.refresh}>刷新列表</button><p>按账号云端保存 · 最多 30 段对话<br/>仅你本人可见，后台不读取内容。</p></div>
 </aside></>;
}
