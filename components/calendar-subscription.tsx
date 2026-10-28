'use client';
import { useState } from 'react';

export function CalendarSubscription({ season }: { season: string }) {
 const [notice, setNotice] = useState('');
 const path = `/api/f1/calendar.ics?season=${encodeURIComponent(season)}`;
 const url = `https://f1.tike69.cc.cd${path}`;
 return <section className="calendar-subscription" aria-labelledby="calendar-subscribe-title">
  <div className="subscription-heading"><div><h2 id="calendar-subscribe-title">赛历订阅</h2><p>在你的日历中查看比赛时间。</p></div><a className="btn-secondary" href={`${path}&download=1`}>下载 {season} 赛历</a></div>
  <details className="subscription-options"><summary>订阅到 Apple、Google 或 Outlook</summary>
   <p className="data-note">订阅会随赛程更新，刷新速度由日历应用决定；下载文件仅是当前快照。</p>
   <div className="subscription-actions"><a className="btn-secondary" href={url.replace('https:', 'webcal:')}>在日历中订阅</a>
    <button type="button" className="btn-secondary" onClick={async () => {
     try { await navigator.clipboard.writeText(url); setNotice('订阅地址已复制。在 Google 日历选择「通过网址添加」，或粘贴到 Outlook 的订阅日历。'); }
     catch { setNotice(`请复制下方订阅地址：${url}`); }
    }}>复制订阅地址</button></div>
   <p className="data-note subscription-help">在 Google 日历的「其他日历 → 通过网址添加」，或 Outlook 的「添加日历 → 从 Web 订阅」粘贴：<br/><a href={url}>{url}</a></p>
   <p className="data-note">事件按 UTC 保存，日历按本地时区显示；网站使用北京时间。时间未公布的节次不生成占位事件，结束时间可能为预计时长。</p>
   <p role="status" className="subscription-notice">{notice}</p>
  </details>
 </section>;
}
