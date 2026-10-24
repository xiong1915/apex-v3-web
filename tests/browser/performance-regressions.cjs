const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('local only');
const out=process.env.QA_ARTIFACT_DIR || path.join(require('node:os').tmpdir(),'apex-performance');
require('node:fs').mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.qaPaints=0;const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){window.qaPaints++;return clear.apply(this,args)}});
 await page.goto(base+'/replay?session=demo-bahrain');await page.getByRole('button',{name:/暂停/}).waitFor();await page.waitForTimeout(800);
 const paints=await page.evaluate(()=>window.qaPaints);await page.waitForTimeout(1200);const delta=await page.evaluate(()=>window.qaPaints)-paints;assert.ok(delta>35,`canvas only ${delta} paints in 1.2 seconds`);
 await page.getByRole('button',{name:/暂停/}).click();await page.waitForTimeout(150);const paused=await page.evaluate(()=>window.qaPaints);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.qaPaints),paused);
 await page.getByRole('slider',{name:'回放进度'}).fill('30000');await page.waitForTimeout(200);assert.equal(await page.getByRole('slider',{name:'回放进度'}).inputValue(),'30000');
 for(const width of [375,390,768,1440,1920]){await page.setViewportSize({width,height:width<768?844:1000});await page.waitForTimeout(120);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if([390,1440].includes(width))await page.screenshot({path:path.join(out,`replay-performance-${width}.png`)});if(width===390){const c=await page.locator('.replay-controls-card').boundingBox(),map=await page.locator('.replay-canvas-area').boundingBox();assert.ok(c.y<map.y,'mobile controls must precede canvas');}}
 await page.getByRole('button',{name:/播放/}).click();await page.waitForTimeout(200);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.getByRole('button',{name:/播放/}).waitFor();const hiddenTime=await page.getByRole('slider').inputValue();await page.waitForTimeout(500);assert.equal(await page.getByRole('slider').inputValue(),hiddenTime);
 console.log('PASS: >30fps canvas, no paused redraw, seeking, background pause, five widths, controls above mobile canvas; canvas paints in1.2s='+delta);
 await page.goto(base+'/');await page.locator('.home-loading').waitFor({state:'detached',timeout:90000});await page.waitForTimeout(1000);
 const scripts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').map(r=>({url:r.name,size:r.decodedBodySize})));assert.ok(scripts.every(s=>s.size<1000000),'home loaded demo payload');
 for(const width of [390,1440]){await page.setViewportSize({width,height:width===390?844:1000});await page.screenshot({path:path.join(out,`home-performance-${width}.png`)});}
 console.log('PASS: homepage has no megabyte DEMO script; script sizes='+JSON.stringify(scripts.map(s=>s.size)));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
