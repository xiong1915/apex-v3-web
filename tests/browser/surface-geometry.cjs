const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3300';
const out=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'apex-surface-geometry');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const p=await browser.newPage();
 for(const route of ['/races/19?season=2026','/races','/standings','/drivers','/teams','/login','/register','/forgot-password','/live']){
  for(const width of [375,390,430,1440]){
   await p.setViewportSize({width,height:width<768?844:1000});await p.goto(base+route,{waitUntil:'domcontentloaded',timeout:90000});await p.waitForTimeout(350);
   const surfaces=await p.evaluate(()=>[...document.querySelectorAll('.page-heading,.race-detail-info,.auth-intro,.rules-note,.data-note,.monitor-alert,.admin-notice,.subscription-notice')].filter(el=>{const box=el.getBoundingClientRect();return box.width>0&&box.height>0&&getComputedStyle(el).backdropFilter!=='none';}).map(el=>{const s=getComputedStyle(el);return {className:el.className,radius:parseFloat(s.borderTopLeftRadius),padding:parseFloat(s.paddingLeft)};}));
   for(const surface of surfaces){assert.ok(surface.radius>=16,`${route} ${width}: sharp material edge ${JSON.stringify(surface)}`);assert.ok(surface.padding>=10,`${route} ${width}: text flush against glass edge ${JSON.stringify(surface)}`);}
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} ${width}: page overflow`);
   if(route.startsWith('/races/19')){assert.equal(await p.locator('.race-detail-info').count(),1);const inner=await p.locator('.race-detail-info .page-heading').evaluate(el=>getComputedStyle(el).backdropFilter);assert.equal(inner,'none','one composed information panel, no nested title patch');await p.screenshot({path:path.join(out,`race-detail-${width}.png`)});}
   // Long localized copy is a DOM-only stress fixture, never sent to any API.
   const overflow=await p.evaluate(()=>{
    const nodes=[...document.querySelectorAll('.btn-primary,.btn-secondary,.glass-button,.admin-button,.subscription-notice,[role="alert"]')].filter(el=>el.getBoundingClientRect().width>0);
    for(const node of nodes){node.textContent='这是一段用于检查窄屏自动换行的较长操作说明，请确认所有文字完整保留且不会超出边界。https://example.invalid/averylongunbrokenmessage';}
    return nodes.filter(el=>el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2).map(el=>({tag:el.tagName,className:el.className,width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight}));
   });
   assert.deepEqual(overflow,[],`${route} ${width}: long text must stay inside control/notice`);
  }
 }
 console.log('PASS rounded/padded glass and long text containment at 375/390/430/1440 across nine routes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
