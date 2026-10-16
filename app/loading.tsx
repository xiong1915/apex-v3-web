export default function Loading() {
 return <div role="status" aria-live="polite" aria-busy="true" style={{minHeight:'calc(100svh - 64px)',display:'grid',placeItems:'center'}}><div style={{display:'grid',justifyItems:'center',gap:22}}><span className="eyebrow">GETTING ON THE GRID</span><div className="loading-lights" aria-hidden="true">{[0,1,2,3,4].map(i=><i key={i} style={{'--light':i} as React.CSSProperties}/>)}</div><span style={{fontSize:13,color:'var(--text-muted)'}}>正在加载赛程与积分数据…</span></div></div>;
}
