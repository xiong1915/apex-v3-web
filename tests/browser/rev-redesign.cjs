const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3300';
const output=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'apex-rev-qa');
fs.mkdirSync(output,{recursive:true});
const session=p=>p.locator('[data-mode][data-phase]');
const phase=async(p,value)=>p.waitForFunction(v=>document.querySelector('[data-phase]')?.getAttribute('data-phase')===v,value,{timeout:25000});
const lobby=async p=>{await p.getByRole('button',{name:'← 模式大厅',exact:true}).click();};
const enter=async(p,mode)=>{await p.getByRole('button',{name:new RegExp('^'+mode+' ')}).click();};
const shot=async(p,name)=>{await p.waitForTimeout(300);await p.screenshot({path:path.join(output,name+'.png'),fullPage:true});};
async function drag(p){
 await enter(p,'DRAG RACE');await p.getByRole('button',{name:/开始比赛/}).click();await phase(p,'COUNTDOWN');
 await p.keyboard.down('KeyW');await p.keyboard.down('ShiftLeft');await phase(p,'GO');await p.keyboard.up('ShiftLeft');await phase(p,'RACING');
 for(let i=0;i<500;i++){
  const sample=await p.evaluate(()=>({phase:document.querySelector('[data-phase]')?.getAttribute('data-phase'),rpm:Number(document.querySelector('[data-rpm]')?.getAttribute('data-rpm')||0)}));
  if(sample.phase==='RESULT')break;
  assert.notEqual(sample.phase,'PAUSED','desktop race must retain foreground focus');
  const rpm=sample.rpm;
  if(rpm>=18300)await p.keyboard.press('KeyE');
  await p.waitForTimeout(40);
 }
 await p.keyboard.up('KeyW');await phase(p,'RESULT');
 assert.match(await p.locator('section[data-mode]').innerText(),/400 METRES/);await shot(p,'drag-result');
 await p.getByRole('button',{name:'再来一局 →'}).click();await phase(p,'COUNTDOWN');
 await p.keyboard.press('ShiftLeft');await phase(p,'RESULT');assert.match(await session(p).innerText(),/抢跑/);
 await lobby(p);
}
async function launch(p){
 await enter(p,'LAUNCH CONTROL');await p.getByRole('button',{name:/开始起步挑战/}).click();
 const pedal=p.getByRole('button',{name:/油门，向上滑动/});const box=await pedal.boundingBox();
 await p.mouse.move(box.x+box.width/2,box.y+box.height*(1-.525));await p.mouse.down();
 await p.keyboard.down('ShiftLeft');await phase(p,'GO');await p.keyboard.up('ShiftLeft');await p.mouse.up();await phase(p,'RESULT');
 assert.match(await session(p).innerText(),/完美起步/);await shot(p,'launch-result');
 await p.getByRole('button',{name:'再来一局 →'}).click();await phase(p,'STABILIZE');
 await lobby(p);
}
async function quiz(p){
 await enter(p,'SOUND QUIZ');await p.getByRole('button',{name:'开始十题挑战'}).click();
 for(let i=0;i<10;i++){
  await p.getByRole('button',{name:'播放 / 重听声浪'}).click();
  await p.waitForTimeout(250);
  await p.getByRole('button',{name:'2004 V10',exact:true}).click();
  await phase(p,'ANSWER');assert.match(await session(p).innerText(),/回答正确|回答错误/);
  if(i===0){await shot(p,'quiz-answer');await p.getByRole('button',{name:'暂停',exact:true}).click();await phase(p,'PAUSED');await p.getByRole('button',{name:'继续游戏'}).click();await phase(p,'ANSWER');assert.equal(await p.evaluate(()=>window.__revAudio.filter(ctx=>ctx.state==='running').length),0,'answer resume stays silent');}
  await p.getByRole('button',{name:i===9?'查看成绩':'下一题 →'}).click();
 }
 await phase(p,'RESULT');await shot(p,'quiz-result');
 await p.getByRole('button',{name:'再来一局 →'}).click();await phase(p,'QUIZ');await lobby(p);
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{window.__revAudio=[];const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);window.__revAudio.push(this);}};});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/rev');await shot(p,'lobby-desktop');
  await drag(p);console.log('PASS desktop drag race, finish, retry, false start');
  await launch(p);console.log('PASS launch target stability, lights, release, result, retry');
  await quiz(p);console.log('PASS ten quiz playback questions, feedback, result, retry');
  await enter(p,'FREE REV');await p.getByRole('button',{name:/^启动引擎/}).click();await phase(p,'FREE');
  await p.keyboard.down('Space');await p.keyboard.down('KeyW');await p.keyboard.up('Space');await p.waitForTimeout(600);
  assert.ok(+(await p.locator('[data-rpm]').getAttribute('data-rpm'))>10000);
  await p.keyboard.up('KeyW');await p.keyboard.press('Escape');await phase(p,'PAUSED');
  await p.getByRole('button',{name:'继续游戏'}).click();await phase(p,'FREE');
  await p.getByRole('button',{name:/油门，向上滑动/}).focus();await p.keyboard.down('Enter');await p.keyboard.press('Tab');await p.keyboard.up('Enter');await p.waitForTimeout(150);assert.match(await p.locator('[data-rpm]').innerText(),/THROTTLE\s*0%/);
  await p.getByRole('button',{name:'静音',exact:true}).click();await p.getByRole('button',{name:'取消静音',exact:true}).click();
  await p.getByRole('button',{name:'熄火',exact:true}).click();await phase(p,'READY');await lobby(p);
  await p.waitForTimeout(150);assert.ok(await p.evaluate(()=>window.__revAudio.every(ctx=>ctx.state==='closed')));console.log('PASS free rev, input arbitration, pause/resume, mute, graph release');
  for(const width of [375,390,430]){
   await p.setViewportSize({width,height:844});await enter(p,'DRAG RACE');await shot(p,'grid-'+width);
   await p.getByRole('button',{name:/开始比赛/}).click();await phase(p,'COUNTDOWN');
   await shot(p,'cockpit-'+width);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const bounds=await p.getByRole('button',{name:/油门，向上滑动/}).boundingBox();assert.ok(bounds.y+bounds.height<=844,`pedal below fold at ${width}: ${JSON.stringify(bounds)}`);
   await lobby(p);
  }
  await p.setViewportSize({width:844,height:390});await enter(p,'DRAG RACE');await shot(p,'landscape');await lobby(p);
  await context.close();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));await m.goto(base+'/rev');await enter(m,'DRAG RACE');await m.getByRole('button',{name:/开始比赛/}).click();await phase(m,'COUNTDOWN');
  const cdp=await mobile.newCDPSession(m);
  const pedal=await m.getByRole('button',{name:/油门，向上滑动/}).boundingBox(),clutch=await m.getByRole('button',{name:/^离合/}).boundingBox();
  const gas={id:1,x:pedal.x+pedal.width/2,y:pedal.y+5},cl={id:2,x:clutch.x+clutch.width/2,y:clutch.y+clutch.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[gas,cl]});await phase(m,'GO');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[cl]});await phase(m,'RACING');
  for(let i=0;i<500;i++){
   const sample=await m.evaluate(()=>({phase:document.querySelector('[data-phase]')?.getAttribute('data-phase'),rpm:Number(document.querySelector('[data-rpm]')?.getAttribute('data-rpm')||0)}));
   if(sample.phase==='RESULT')break;
   assert.notEqual(sample.phase,'PAUSED','mobile race must retain foreground focus');
   const rpm=sample.rpm;
   if(rpm>=18300){const b=await m.getByRole('button',{name:'升挡 E',exact:true}).boundingBox();const sh={id:3,x:b.x+b.width/2,y:b.y+b.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[gas,sh]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[sh]});}
   await m.waitForTimeout(40);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await phase(m,'RESULT');await shot(m,'mobile-race-result');console.log('PASS mobile real multi-touch throttle/clutch/shifts complete race');
  assert.deepEqual(errors,[]);console.log('PASS no uncaught browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
