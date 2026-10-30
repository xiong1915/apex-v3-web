const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3301';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__revAudio=[];const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);window.__revAudio.push(this);}};});
  await p.goto(base+'/rev');await p.getByRole('button',{name:/^FREE REV /}).click();await p.getByRole('button',{name:/^启动引擎/}).click();
  await p.waitForFunction(()=>document.querySelector('[data-phase]')?.getAttribute('data-phase')==='FREE');
  const cdp=await p.context().newCDPSession(p);await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  const before=await metrics();
  for(let i=0;i<120;i++){
   if(i%2===0)await p.keyboard.down('KeyW');else await p.keyboard.up('KeyW');
   await p.waitForTimeout(1000);
   if((i+1)%30===0){const sample=await metrics();console.log(JSON.stringify({seconds:i+1,heap:sample.JSHeapUsedSize,nodes:sample.Nodes,listeners:sample.JSEventListeners,taskSeconds:sample.TaskDuration-before.TaskDuration}));}
  }
  await p.keyboard.up('KeyW');await p.keyboard.press('Escape');
  await p.getByRole('button',{name:'继续游戏'}).click();await p.getByRole('button',{name:'熄火',exact:true}).click();
  await p.getByRole('button',{name:'← 模式大厅',exact:true}).click();await p.waitForTimeout(200);
  await cdp.send('HeapProfiler.collectGarbage');const after=await metrics();
  assert.ok(after.JSHeapUsedSize-before.JSHeapUsedSize<32*1024*1024,'bounded retained memory over two minutes');
  assert.ok(await p.evaluate(()=>window.__revAudio.every(ctx=>ctx.state==='closed')),'all AudioContexts close after stop/exit');
  assert.deepEqual(errors,[]);console.log('PASS two-minute rev/backfire soak, pause/resume, bounded memory and released AudioContexts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
