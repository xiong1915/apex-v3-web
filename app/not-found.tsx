import Link from 'next/link';
export default function NotFound(){return <section className="message-state"><div><span className="state-symbol mono">404</span><h1>这个页面不在赛历中</h1><p>链接可能已更改，也可能暂未收录对应的车手、车队或分站。</p><div className="state-actions"><Link href="/races" className="btn-primary">浏览赛历</Link><Link href="/" className="btn-secondary">返回首页</Link></div></div></section>}
