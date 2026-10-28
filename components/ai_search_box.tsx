// components/ai_search_box.tsx
// 首页 AI 交互入口：采用 Liquid Glass 输入组件，通过 URL 传递用户主动提交的问题

'use client';

import React, { useState, useEffect } from 'react';
import { fetchCurrentSession } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { GlassComposer } from '@/components/glass/GlassComposer';
import { GlassButton } from '@/components/glass/GlassButton';

const SUGGESTIONS = [
  '2026 赛季当前车手积分榜前五名是谁？',
  '新加坡大奖赛正赛几点开赛？包含冲刺赛吗？',
  '解释一下什么是 Undercut 战术以及它的成功前提',
  '谁是上一场大奖赛的分站冠军？'
];

export function AIAccountHint() {
  const [text, setText] = useState('正在确认登录状态…');
  useEffect(() => {
    let revision = 0;
    const load = async () => {
      const current = ++revision;
      setText('正在确认登录状态…');
      const { user, error } = await fetchCurrentSession();
      if (current === revision) setText(error ? '身份服务暂不可用，可进入对话页重试' : user ? '已登录，可直接开启对话' : '登录后开启对话');
    };
    void load();
    window.addEventListener('apex:identity-changed', load);
    return () => { revision++; window.removeEventListener('apex:identity-changed', load); };
  }, []);
  return <p className="data-note" style={{marginTop:16}}>{text}</p>;
}

export function AISearchBox({ defaultLight = false }: { defaultLight?: boolean }) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  const handleSubmit = (textToSubmit?: string) => {
    const q = (textToSubmit || query).trim();
    if (!q) return;

    router.push('/ai?q=' + encodeURIComponent(q));
  };

  const isLight = defaultLight;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      {/* Search Input Box using GlassComposer */}
      <GlassComposer
        isFocused={isFocused}
        style={{
          background: isLight ? 'rgba(255, 255, 255, 0.92)' : undefined,
          border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : undefined,
          boxShadow: isLight ? '0 8px 30px rgba(0, 0, 0, 0.08)' : undefined,
          padding: '6px 8px 6px 18px'
        }}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: '12px'
          }}
        >
          <input
            type="text"
            aria-label="向 APEX AI 提问"
            name="question"
            autoComplete="off"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="询问赛程、积分、车手或比赛规则…"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              color: isLight ? 'var(--text-dark-primary)' : 'var(--text-primary)',
              paddingRight: '12px'
            }}
          />

          <GlassButton
            type="submit"
            variant="primary"
            size="md"
            disabled={!query.trim()}
            style={{
              opacity: !query.trim() ? 0.6 : 1,
              whiteSpace: 'nowrap',
              minHeight: '38px',
              padding: '6px 16px'
            }}
          >
            <span>询问 AI</span>
            <span style={{ fontSize: '12px' }}>→</span>
          </GlassButton>
        </form>
      </GlassComposer>

      {/* Suggestion Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
        {SUGGESTIONS.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSubmit(s)}
            className="glass-button glass-btn-ghost glass-btn-sm"
            style={{
              background: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)',
              border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid var(--line-dark)',
              color: isLight ? 'var(--text-dark-secondary)' : 'var(--text-secondary)',
              borderRadius: 'var(--radius-pill)',
              padding: '6px 14px',
              fontSize: '12px'
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
