const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3300';
const out=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'tikeai-rev-layout');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'chrome'});try{
 const p=await b.newPage();
 for(const width of [375,390,430,768,1024,1440,1920]){
  const height=width<768?844:1000;await p.setViewportSize({width,height});await p.goto(base+'/rev');
  const lobby=p.getByRole('region',{name:'模式大厅'});await lobby.waitFor();
  const drag=p.getByRole('button',{name:/^DRAG RACE /}),box=await drag.boundingBox();
  const header=await p.locator('main header').boundingBox();
  assert.ok(box.y-header.y-header.height>=16,'header and mode cards have breathing room at '+width);
  if(width>=1024){assert.ok(box.height<=360,'featured mode is not stretched by three stacked neighbours at '+width);for(const mode of ['FREE REV','LAUNCH CONTROL','SOUND QUIZ']){const rect=await p.getByRole('button',{name:new RegExp('^'+mode+' ')}).boundingBox();assert.ok(rect.y+rect.height<=height,'all four modes appear in first desktop screen at '+width);}}
  else if(width<768)assert.ok(box.y+box.height<=height,'primary mode visible without hunting at '+width);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const sound=p.getByRole('button',{name:'静音',exact:true});const soundBox=await sound.boundingBox();assert.ok(soundBox.width>=43.9&&soundBox.height>=43.9,'44px sound target at '+width);
  await p.screenshot({path:path.join(out,'lobby-'+width+'.png'),animations:'disabled'});
 }
 console.log('PASS Rev lobby: clear spacing, bounded feature card, four desktop modes visible, primary mobile mode and sound control fit seven viewports');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
