import Link from 'next/link';
export function Footer() {
 return <footer className="race-footer"><div className="container">
  <div className="footer-wordmark" aria-hidden="true">LIGHTS OUT.</div>
  <div className="footer-grid"><div><Link href="/" className="footer-brand">APEX<span style={{color:'var(--accent-red)'}}> /</span></Link><p>THE RACE STARTS HERE.<br/>每一站赛程，每一次争夺。<br/>你的一级方程式赛车数据与赛事分析平台。</p></div>
  <nav aria-label="页脚赛事导航"><span className="eyebrow">EXPLORE THE GRID</span><Link href="/races">全季赛历 ↗</Link><Link href="/standings">锦标赛积分 ↗</Link><Link href="/drivers">车手档案 ↗</Link><Link href="/teams">车队档案 ↗</Link></nav>
  <nav aria-label="页脚工具导航"><span className="eyebrow">GO BEYOND THE RACE</span><Link href="/ai">APEX AI ↗</Link><Link href="/replay">APEX REPLAY ↗</Link><Link href="/#simulator">积分试算 ↗</Link><Link href="/login">账户登录 ↗</Link></nav></div>
  <div className="footer-meta"><span>非官方 F1 数据项目。与 FIA、Formula 1 及各参赛车队无商业隶属关系。<br/>开赛时间统一展示为北京时间 (UTC+8)。赛道素材沿用项目现有 MIT 许可资产。</span><span className="mono">APEX V3 / LIGHTS OUT<br/>BUILT FOR THE LOVE OF RACING.</span></div>
 </div></footer>;
}
