// app/ai/page.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AIMessage, AISource, AIFactCard } from '@/lib/ai/types';
import { GlassComposer, GlassButton } from '@/components/glass';
import { MarkdownRenderer } from '@/components/markdown_renderer';
import { fetchCurrentSession } from '@/lib/auth/client';
import { consumeAIStream } from '@/lib/ai/client-stream';
import type { ChatTurn } from '@/lib/ai/conversation-types';
import { useConversationHistory } from '@/lib/ai/use-conversation-history';
import { buildChatContext } from '@/lib/ai/chat-context';
import { ConversationSidebar } from '@/components/conversation-sidebar';

export type AIStatus =
  | 'idle'
  | 'composing'
  | 'submitting'
  | 'streaming'
  | 'completed'
  | 'error'
  | 'aborted'
  | 'rate_limited'
  | 'offline';

const PROMPT_SUGGESTIONS = [
  '2026 赛季当前车手积分榜前五名是谁？',
  '新加坡大奖赛正赛几点开赛？包含冲刺赛吗？',
  '解释一下什么是 Undercut 战术以及它的成功前提',
  '谁是上一场大奖赛的分站冠军？'
];

export default function AIPage() {
  return <React.Suspense fallback={<div className="loading-state" role="status"><h2>正在打开 AI…</h2><p>正在准备对话界面，请稍候。</p></div>}><AIWorkspace/></React.Suspense>;
}

function AIWorkspace() {
  const searchParams = useSearchParams();
  const draftQuestion = (searchParams.get('draft') || '').trim().slice(0, 2000);
  const queryQuestion = searchParams.get('q') || searchParams.get('prompt') || '';
  const draftHandledRef = useRef('');
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AIStatus>('idle');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSources, setStreamingSources] = useState<AISource[]>([]);
  const [streamingFactCard, setStreamingFactCard] = useState<AIFactCard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [accountId, setAccountId] = useState('');
  const accountRef = useRef('');
  const recoveryRef = useRef({messages: [] as ChatTurn[], input: ''});
  recoveryRef.current = {messages, input};
  const accountDrafts = useRef(new Map<string, {messages: ChatTurn[]; input: string}>());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [responseMode, setResponseMode] = useState('自动选择事实快答或深度分析');
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const isGenerating = status === 'submitting' || status === 'streaming';

  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const submissionLockRef = useRef(false);
  const initialPromptHandledRef = useRef(false);
  const isComposingRef = useRef(false); // 中文输入法组合保护
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replaceConversationMessages = useCallback((turns: ChatTurn[]) => {
    setMessages(turns);
    setErrorMessage(null);
    setLastFailedInput(null);
    setStreamingContent('');
    setStreamingSources([]);
    setStreamingFactCard(null);
    setStatus('idle');
    setResponseMode('自动选择事实快答或深度分析');
    userScrolledUpRef.current = false;
  }, []);
  const history = useConversationHistory(!authChecking, messages, replaceConversationMessages, isGenerating, submissionLockRef, accountId);

  // 校验登录状态：未登录访问自动跳转登录页，并保留提问输入
  useEffect(() => {
    let mounted = true;
    let revision = 0;
    const verify = () => {
      const current = ++revision;
      setAuthChecking(true);
      fetchCurrentSession().then(({ user, error }) => {
        if (!mounted || current !== revision) return;
        if (error) { const pending = abortControllerRef.current; abortControllerRef.current = null; pending?.abort(); submissionLockRef.current = false; setAuthError(error); return; }
        setAuthError(null);
        if (accountRef.current !== (user?.id || '')) {
          const pending = abortControllerRef.current;
          abortControllerRef.current = null;
          pending?.abort();
          submissionLockRef.current = false;
          const oldOwner = accountRef.current;
          if (oldOwner && (recoveryRef.current.messages.length || recoveryRef.current.input)) {
            accountDrafts.current.set(oldOwner, recoveryRef.current);
          }
          const recovered = user?.id ? accountDrafts.current.get(user.id) : undefined;
          replaceConversationMessages(recovered?.messages || []);
          setInput(recovered?.input || '');
          accountRef.current = user?.id || '';
        }
        setAccountId(user?.id || '');
        if (!user) router.replace('/login?returnUrl=' + encodeURIComponent('/ai' + window.location.search));
        else setAuthChecking(false);
      });
    };
    verify();
    window.addEventListener('apex:identity-changed', verify);
    return () => { mounted = false; window.removeEventListener('apex:identity-changed', verify); };
  }, [router]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  // 隐藏全局 footer，使 AI 控制台独占视口高度并防止窗口滚动切除顶部
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (footer) {
      footer.style.display = 'none';
      return () => {
        footer.style.display = '';
      };
    }
  }, []);

  // 监听容器内滚动事件，判断用户是否正在上滑查看历史内容
  const handleContainerScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    userScrolledUpRef.current = !isNearBottom;
  };

  // 仅在消息容器内部滚动，绝不触发外部窗口全局滚动
  const scrollToBottom = (smooth = true) => {
    if (!messagesContainerRef.current) return;
    if (!userScrolledUpRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  // 当产生新消息或流式内容推进时，在内部容器向下平滑跟随
  useEffect(() => {
    if (messages.length > 0 || streamingContent) {
      scrollToBottom(true);
    }
  }, [messages, streamingContent]);

  // 中断当前流式请求
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('aborted');
    if (streamingContent || streamingFactCard) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: (streamingContent || '') + ' [已中断生成]',
          sources: streamingSources,
          factCard: streamingFactCard || undefined,
          status: 'aborted'
        }
      ]);
      setStreamingContent('');
      setStreamingSources([]);
      setStreamingFactCard(null);
    }
  }, [streamingContent, streamingSources, streamingFactCard]);

  // 发送消息
  const sendMessage = useCallback(async (textToSend?: string, retry = false) => {
    const q = (textToSend !== undefined ? textToSend : input).trim();
    if (!q || submissionLockRef.current || history.isBusy() || status === 'submitting' || status === 'streaming' || history.saving || history.loading) return;
    if (q.length > 1000) { setErrorMessage('每次提问最多 1000 字，请缩短后发送'); return; }
    if (messages.length >= 98) { setErrorMessage('这段对话已达到 100 条消息上限，请新建对话继续'); return; }

    submissionLockRef.current = true;
    // 清除上一次中断
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: q,
      status: 'completed'
    };

    const retryIndex = retry ? messages.findLastIndex(m => m.role === 'user' && m.content === q) : -1;
    const nextHistory = retryIndex >= 0 ? messages : [...messages, userMsg];
    setMessages(nextHistory);
    userScrolledUpRef.current = false;
    setInput('');
    setStatus('submitting');
    setResponseMode('正在判断问题类型…');
    setStreamingContent('');
    setStreamingSources([]);
    setStreamingFactCard(null);
    setErrorMessage(null);

    const apiPayload: AIMessage[] = buildChatContext(retryIndex >= 0 ? messages.slice(0, retryIndex + 1) : nextHistory);
    let collectedText = '';
    let collectedSources: AISource[] = [];
    let collectedFactCard: AIFactCard | null = null;

    try {
      const draftSave = history.save(nextHistory);
      // Draft errors remain visible in the history controller; do not delay first token.
      void draftSave.catch(() => {});
      if (controller.signal.aborted) return;
      setStatus('streaming');
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-apex-history-owner': accountId },
        body: JSON.stringify({
          messages: apiPayload,
          stream: true,
          deviceSignals: typeof window !== 'undefined' ? {
            screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
            viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
            dpr: window.devicePixelRatio || 1,
            cores: navigator.hardwareConcurrency || undefined,
            memory: (navigator as any).deviceMemory || undefined,
            touch: navigator.maxTouchPoints > 0,
            language: navigator.language || undefined,
            colorScheme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          } : undefined
        }),
        signal: controller.signal
      });

      if (abortControllerRef.current !== controller || controller.signal.aborted) return;

      if (res.status === 401) {
        setStatus('idle');
        try { sessionStorage.setItem('apex_ai_prompt', q); } catch {}
        router.push('/login?returnUrl=' + encodeURIComponent('/ai?q=' + encodeURIComponent(q)));
        return;
      }

      if (res.status === 429) {
        setStatus('rate_limited');
        const retryAfter = res.headers.get('Retry-After') || '60';
        const errJson = await res.json().catch(() => null);
        const reason = errJson?.error || '请求过于频繁，请稍候再试';
        throw Object.assign(new Error(`${reason} (请等待 ${retryAfter} 秒)`), { status: 429 });
      }

      if (!res.ok) {
        throw new Error(`服务端异常 (HTTP ${res.status})`);
      }

      if (!res.body) {
        throw new Error('无法建立数据流连接通道');
      }

      await consumeAIStream(res.body, parsed => {
        if (abortControllerRef.current !== controller || controller.signal.aborted) return;
        if (parsed.type === 'meta' && parsed.label) {
          setResponseMode(parsed.label);
        } else if (parsed.type === 'delta' && parsed.content) {
          collectedText += parsed.content;
          setStreamingContent(collectedText);
        } else if (parsed.type === 'fact_card' && parsed.factCard) {
          collectedFactCard = parsed.factCard;
          setStreamingFactCard(collectedFactCard);
        } else if (parsed.type === 'sources' && Array.isArray(parsed.sources)) {
          collectedSources = parsed.sources;
          setStreamingSources(collectedSources);
        }
      }, controller.signal);
      if (abortControllerRef.current !== controller || controller.signal.aborted) return;
      // 完成流式
      setMessages(prev => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: collectedText,
          sources: collectedSources,
          factCard: collectedFactCard || undefined,
          status: 'completed'
        }
      ]);
      setStreamingContent('');
      setStreamingSources([]);
      setStreamingFactCard(null);
      setStatus('completed');
    } catch (err: any) {
      if (abortControllerRef.current !== controller) return;
      if(collectedText || collectedFactCard){
        setMessages(prev=>[...prev,{
          id:`partial-${Date.now()}`, role:'assistant', content:collectedText, sources:collectedSources,
          ...(collectedFactCard ? {factCard:collectedFactCard} : {}), status:'error'
        }]);
        setStreamingContent('');setStreamingSources([]);setStreamingFactCard(null);
      }
      if (err.name === 'AbortError' || controller.signal.aborted) {
        setStatus('aborted');
      } else if (!navigator.onLine) {
        setStatus('offline');
        setErrorMessage('网络已断开，请检查网络连接');
        setLastFailedInput(q);
      } else {
        setStatus(err.status === 429 ? 'rate_limited' : 'error');
        setErrorMessage(err.message || '请求超时或连接失败');
        setLastFailedInput(q);
      }
    } finally {
      submissionLockRef.current = false;
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }, [input, messages, status, accountId, history.save, history.saving, history.loading, history.isBusy]);

  useEffect(() => { initialPromptHandledRef.current = false; }, [queryQuestion]);

  // Context links only prefill; do not wait for the history list or call the model.
  useEffect(() => {
    if (!draftQuestion) { draftHandledRef.current = ''; return; }
    if (authChecking || !accountId) return;
    const key = accountId + ':' + draftQuestion;
    if (draftHandledRef.current === key) return;
    draftHandledRef.current = key;
    initialPromptHandledRef.current = true;
    try { sessionStorage.removeItem('apex_ai_prompt'); } catch {}
    setInput(draftQuestion);
    textareaRef.current?.focus();
  }, [draftQuestion, authChecking, accountId]);

  // Explicit questions submitted from the home composer keep their send-once behavior.
  useEffect(() => {
    if (draftQuestion || authChecking || !history.ready || history.loading || history.saving || initialPromptHandledRef.current || submissionLockRef.current) return;
    const url = new URL(window.location.href);
    let storedPrompt = '';
    try { storedPrompt = sessionStorage.getItem('apex_ai_prompt') || ''; } catch {}
    const prompt = queryQuestion || storedPrompt;
    if (!prompt) { initialPromptHandledRef.current = true; return; }
    initialPromptHandledRef.current = true;
    try { sessionStorage.removeItem('apex_ai_prompt'); } catch {}
    url.searchParams.delete('q'); url.searchParams.delete('prompt');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    setInput(prompt);
    void sendMessage(prompt);
  }, [sendMessage, queryQuestion, draftQuestion, authChecking, history.ready, history.loading, history.saving]);

  // 恢复失败前提问内容至输入框
  const handleRestoreInput = () => {
    if (lastFailedInput) {
      setInput(lastFailedInput);
      setLastFailedInput(null);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  // 重试最近一次提问
  const handleRetry = () => {
    const lastUserTurn = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserTurn) {
      sendMessage(lastUserTurn.content, true);
    }
  };

  // 键盘回车与中文输入法 (IME) 防误触
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isComposingRef.current) {
        // 正在拼音输入法候选词输入中，不触发提交
        return;
      }
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClear = () => {
    if (isGenerating || submissionLockRef.current) return;
    void history.startNew();
    setStreamingContent('');
    setStreamingSources([]);
    setErrorMessage(null);
    setStatus('idle');
  };

  if (authError) return <div className="page-shell container" role="alert"><p>{authError}</p><button className="btn-primary" onClick={() => window.location.reload()}>重试连接</button></div>;

  if (authChecking) {
    return (
      <div style={{ height: 'calc(100dvh - var(--nav-height))', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)', animation: 'pulse 1.5s infinite' }}></span>
          <span role="status">正在确认登录状态，准备 AI 对话…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-workspace">
    <ConversationSidebar history={history} disabled={isGenerating} open={historyOpen} onClose={closeHistory}/>
    <div
      className="ai-chat-console"
      style={{
        height: 'calc(100dvh - var(--nav-height))',
        maxHeight: 'calc(100dvh - var(--nav-height))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-primary)'
      }}
    >
      {/* 顶部固定标题栏 (Pinned Header，绝不随滚动消失) */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--line-dark)', padding: '14px 0', background: 'var(--bg-secondary)', backdropFilter: 'none', zIndex: 10 }}>
        <div className="container" style={{ maxWidth: '880px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
              APEX AI · 赛事助手
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn-secondary history-toggle" aria-controls="conversation-history" aria-expanded={historyOpen} onClick={() => setHistoryOpen(true)}>历史对话</button>
            {messages.length > 0 && (
              <GlassButton variant="ghost" size="sm" onClick={handleClear} disabled={isGenerating || history.saving}>
                新建对话
              </GlassButton>
            )}
            <Link href="/system" style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 10px' }}>
              连接状态
            </Link>
          </div>
        </div>
      </div>

      <div className="history-save-status" role="status">{responseMode&&<span className="ai-response-mode">{responseMode}</span>}<span>{history.loading ? '正在读取历史对话，问题可以先编辑…' : history.error ? <><span>{history.error}</span>{history.saveError && <><button onClick={() => void history.save(messages)} disabled={history.saving || isGenerating}>重试保存</button><button onClick={history.saveAsNew} disabled={history.saving || isGenerating}>另存为新对话</button><button onClick={history.downloadDraft}>下载未保存草稿</button></>}</> : history.saving ? '正在保存到云端…' : history.activeId && !history.hasUnsaved ? '已保存到云端 · AI 参考最近的对话上下文' : messages.length ? '当前内容待保存到云端' : '提问后自动保存到账号历史'}</span></div>

      {/* 消息滚动区 (Scrollable Messages Stream) */}
      <div
        ref={messagesContainerRef}
        onScroll={handleContainerScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 0',
          overscrollBehavior: 'contain'
        }}
      >
        <div className="container" style={{ maxWidth: '880px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {messages.length === 0 && !isGenerating && (
            <div className="ai-welcome" style={{ textAlign: 'center', padding: '48px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed var(--line-dark)' }}>
              <div className="ai-welcome-mark" aria-hidden="true">A</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>今天想了解哪场比赛？</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 20px', lineHeight: 1.6 }}>
                查询赛程与积分，或讨论赛车技术和比赛策略。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {PROMPT_SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(s)}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--line-dark)',
                      color: 'var(--text-secondary)',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              {/* 事实快通道卡片 (Fact Fast Path) */}
              {m.factCard && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: '88%',
                    background: 'rgba(255, 45, 32, 0.05)',
                    border: '1px solid rgba(255, 45, 32, 0.25)',
                    borderRadius: '16px',
                    padding: '14px 18px',
                    marginBottom: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--accent-red)' }}>
                      {m.factCard.title}
                    </span>
                    {m.factCard.badge && (
                      <span className="badge-pill badge-red" style={{ fontSize: '10px' }}>
                        {m.factCard.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {m.factCard.fields.map((f, fIdx) => (
                      <div key={fIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: fIdx === m.factCard!.fields.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {m.content && (
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '14px 18px',
                    borderRadius: '20px',
                    background: m.role === 'user' ? 'var(--accent-red)' : 'var(--bg-secondary)',
                    color: m.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                    border: m.role === 'user' ? 'none' : '1px solid var(--line-dark)',
                    lineHeight: 1.65,
                    fontSize: '15px',
                    wordBreak: 'break-word',
                    boxShadow: 'none'
                  }}
                >
                  {m.role === 'user' ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  ) : (
                    <MarkdownRenderer content={m.content} />
                  )}
                </div>
              )}

              {m.sources && m.sources.length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '88%', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>数据溯源:</span>
                  {m.sources.map((s, sIdx) => (
                    <span key={sIdx} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>{s.name}</a>
                      ) : s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* 流式生成中的气泡 */}
          {isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              {streamingFactCard && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: '88%',
                    background: 'rgba(255, 45, 32, 0.05)',
                    border: '1px solid rgba(255, 45, 32, 0.25)',
                    borderRadius: '16px',
                    padding: '14px 18px',
                    marginBottom: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--accent-red)' }}>
                      {streamingFactCard.title}
                    </span>
                    {streamingFactCard.badge && (
                      <span className="badge-pill badge-red" style={{ fontSize: '10px' }}>
                        {streamingFactCard.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {streamingFactCard.fields.map((f, fIdx) => (
                      <div key={fIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: fIdx === streamingFactCard.fields.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  maxWidth: '88%',
                  padding: '14px 18px',
                  borderRadius: '20px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--line-dark)',
                  lineHeight: 1.65,
                  fontSize: '15px',
                  wordBreak: 'break-word'
                }}
              >
                {streamingContent ? (
                  <MarkdownRenderer content={streamingContent} />
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>
                    正在核对资料并准备回答…
                  </span>
                )}
              </div>

              {streamingSources.length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontWeight: 700 }}>数据溯源:</span>
                  {streamingSources.map((s, sIdx) => (
                    <span key={sIdx} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>{s.name} ↗</a>
                      ) : s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 异常提示与重试 */}
          {errorMessage && (
            <div
              style={{
                padding: '14px 18px',
                background: 'rgba(255,45,32,0.1)',
                border: '1px solid rgba(255,45,32,0.3)',
                borderRadius: '14px',
                color: 'var(--accent-red)',
                fontSize: '13px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <span>{errorMessage}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {lastFailedInput && (
                  <GlassButton variant="ghost" size="sm" onClick={handleRestoreInput}>
                    恢复输入
                  </GlassButton>
                )}
                <GlassButton variant="primary" size="sm" onClick={handleRetry}>
                  重试
                </GlassButton>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 底部固定输入框 (Pinned Bottom Composer) */}
      <div style={{ flexShrink: 0, padding: '12px 0 env(safe-area-inset-bottom, 16px)', background: 'var(--bg-secondary)', borderTop: '1px solid var(--line-dark)', zIndex: 10 }}>
        <div className="container" style={{ maxWidth: '880px', width: '100%' }}>
          <GlassComposer isFocused={isFocused} style={{ padding: '8px 12px 8px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <textarea aria-label="向 APEX AI 提问" name="message"
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  if (status === 'completed' || status === 'idle') {
                    setStatus('composing');
                  }
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  isComposingRef.current = false;
                }}
                onKeyDown={handleKeyDown}
                placeholder="输入 F1 问题（Enter 发送，Shift+Enter 换行）..."
                disabled={isGenerating || history.saving}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '15px',
                  color: 'var(--text-primary)',
                  resize: 'none',
                  maxHeight: '120px',
                  lineHeight: 1.4,
                  padding: '6px 0',
                  fontFamily: 'inherit'
                }}
              />

              {isGenerating ? (
                <GlassButton variant="danger" size="md" onClick={handleStop}>
                  停止
                </GlassButton>
              ) : (
                <GlassButton
                  variant="primary"
                  size="md"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || history.saving || history.loading}
                  style={{ opacity: !input.trim() ? 0.5 : 1, cursor: !input.trim() ? 'not-allowed' : 'pointer' }}
                >
                  发送
                </GlassButton>
              )}
            </div>
          </GlassComposer>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
            AI 回答可能有误，请以所附官方来源为准
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
