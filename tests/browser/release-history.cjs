// Read-only public UI checks. No account fixtures or mutations.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3301';
const out=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'tike-release-history');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'chrome',proxy:process.env.QA_PROXY?{server:process.env.QA_PROXY}:undefined});try{
 const p=await b.newPage();await p.goto(base+'/login');
 for(const width of [375,390,430,1440]){
  await p.setViewportSize({width,height:900});
  assert.equal(await p.locator('.nav-brand').innerText(),'tike');assert.equal(await p.locator('.nav-brand').getAttribute('aria-label'),'tike 首页');
  assert.match(await p.locator('.nav-ai').innerText(),/^tikeai/,'AI entry retains its name');
  const history=p.locator('#upgrade-history');assert.equal(await history.getAttribute('open'),null);
  await history.locator('summary').focus();await p.keyboard.press('Enter');await history.getByRole('table').waitFor();
  const text=await history.locator('summary small').innerText(),count=Number(text.match(/(\d+) 次更新/)[1]);
  assert.equal(await history.locator('tbody tr').count(),count);assert.ok(count>=81,'missed main-branch updates are included');
  for(const sha of ['e851fa7','4020ef1','d64c875','d09cc02','8cc1389','1cc4561','2ee72ab','1180472'])assert.equal(await history.locator(`tbody tr:not(.history-current) a[href*="/commit/${sha}"]`).count(),1,sha);
  const current=await history.locator('.history-current td').last().innerText();assert.ok(current.trim());assert.doesNotMatch(current,/校准全站倒计时时钟基准与后退唤醒/,'current description is not the stale hardcoded paragraph');
  await history.locator('tbody tr').last().scrollIntoViewIfNeeded();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await history.locator('.history-scroll').evaluate(el=>{el.scrollTop=0;});
  await history.screenshot({path:path.join(out,'history-'+width+'.png'),animations:'disabled',style:'.site-header{visibility:hidden!important}'});
  await history.locator('summary').focus();await p.keyboard.press('Enter');assert.equal(await history.getAttribute('open'),null);
 }
 console.log('PASS bottom update history: backfilled versions, root link, current description, counts, keyboard disclosure, tike wordmark/tikeai AI and four widths');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
