const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3300';
const out=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'tikeai-team-colors');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage();
 for(const width of [375,390,430,1440]){
  await p.setViewportSize({width,height:width<768?844:1000});await p.goto(base+'/teams');await p.locator('.team-tile').first().waitFor();
  const cards=await p.locator('.team-tile').evaluateAll(nodes=>nodes.map(el=>{const s=getComputedStyle(el),name=el.querySelector('h2');return {color:s.getPropertyValue('--team-color').trim(),bg:s.backgroundColor,accent:getComputedStyle(el,'::before').backgroundImage,overflow:name.scrollWidth>name.clientWidth+1};}));
  assert.ok(cards.length>0);for(const card of cards){assert.match(card.color,/^#[\da-f]{6}$/i,'each team has a mapped accent');assert.equal(card.bg,'rgba(0, 0, 0, 0)','preserve clear glass');assert.notEqual(card.accent,'none','visible livery accent');assert.equal(card.overflow,false);}
  if(cards.length>=3)assert.ok(new Set(cards.map(c=>c.color)).size>=3,'teams remain visually distinct');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(out,'teams-'+width+'.png'),animations:'disabled'});
 }
 console.log('PASS team identity colors: mapped accents, glass retained, distinct liveries and contained names at four widths');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
