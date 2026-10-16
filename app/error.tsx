'use client';
import Link from 'next/link';
export default function ErrorBoundary({reset}:{error:Error&{digest?:string};reset:()=>void}){return <section className="message-state" role="alert"><div><span className="state-symbol" aria-hidden="true">↻</span><h1>暂时没有连接上</h1><p>页面内容未能完成加载。请重试，或先返回首页查看其他赛事信息。</p><div className="state-actions"><button type="button" className="btn-primary" onClick={reset}>重新加载</button><Link href="/" className="btn-secondary">返回首页</Link></div></div></section>}
