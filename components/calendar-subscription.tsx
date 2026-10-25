'use client';
import { useState } from 'react';

export function CalendarSubscription({ season }: { season: string }) {
 const [notice, setNotice] = useState('');
 const path = `/api/f1/calendar.ics?season=${encodeURIComponent(season)}`;
 const url = `https://f1.tike69.cc.cd${path}`;
 return <section className="calendar-subscription" aria-labelledby="calendar-subscribe-title" style={{padding:'24px',marginBottom:32,border:'1px solid var(--line-dark)',borderRadius:24}}>
  <h2 id="calendar-subscribe-title" style={{fontSize:22,marginBottom:8}}>把比赛放进你的日历</h2>
  <p className="data-note">Apple、Google 与 Outlook 均可导入 ICS。订阅会随赛程更新，实际刷新速度由日历应用决定；下载文件仅是当前快照。</p>
  <div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:16}}>
   <a className="btn-primary" href={`${path}&download=1`}>下载 {season} 赛历</a>
   <a className="btn-secondary" href={url.replace('https:', 'webcal:')}>在日历中订阅</a>
   <button type="button" className="btn-secondary" onClick={async () => {
    try { await navigator.clipboard.writeText(url); setNotice('订阅地址已复制。在 Google 日历选择「通过网址添加」，或粘贴到 Outlook 的订阅日历。'); }
    catch { setNotice(`请复制下方订阅地址：${url}`); }
   }}>复制订阅地址</button>
  </div>
  <details style={{marginTop:16}}><summary>Google / Outlook 订阅说明</summary><p className="data-note" style={{overflowWrap:'anywhere',marginTop:8}}>在 Google 日历的「其他日历 → 通过网址添加」，或 Outlook 的「添加日历 → 从 Web 订阅」粘贴：<br/><a href={url}>{url}</a><br/>事件按 UTC 保存，日历按你的本地时区显示；网站始终显示北京时间。时间未公布的节次不会生成占位事件。结束时间可能为预计时长。</p></details>
  <p role="status" className="data-note" style={{marginTop:8}}>{notice}</p>
 </section>;
}
