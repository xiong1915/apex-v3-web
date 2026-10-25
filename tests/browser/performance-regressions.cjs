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
 await page.goto(base+'/');await page.locator('.home-loading').waitFor({state:'detached',timeout:90000});await page.waitForTimeout(1000);
 const scripts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').map(r=>({url:r.name,size:r.decodedBodySize})));assert.ok(scripts.every(s=>s.size<1000000),'home loaded demo payload');
 for(const width of [390,1440]){await page.setViewportSize({width,height:width===390?844:1000});await page.screenshot({path:path.join(out,`home-performance-${width}.png`)});}
 console.log('PASS: homepage has no megabyte DEMO script; script sizes='+JSON.stringify(scripts.map(s=>s.size)));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
