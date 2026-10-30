// Original decorative physics only; localhost and read-only public navigation.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3100/',{timeout:90000});
 const helmet=page.getByRole('button',{name:/互动赛车头盔/});await helmet.waitFor();
 const original=await helmet.boundingBox();
 await page.mouse.move(original.x+original.width/2,original.y+original.height/2);await page.mouse.down();await page.mouse.move(original.x+original.width/2+130,original.y+original.height/2+30,{steps:10});await page.waitForTimeout(250);
 const dragged=await helmet.evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m41);assert.ok(dragged>20,'drag visibly displaces the helmet');assert.ok(dragged<70,'drag remains bounded');
 await page.mouse.up();await page.mouse.move(0,0);await page.waitForTimeout(2000);
 const settled=await helmet.boundingBox();assert.ok(Math.abs(settled.x-original.x)<1,'spring returns to its anchor');
 await helmet.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(80);assert.notEqual(await helmet.evaluate(e=>e.style.transform),'none','keyboard applies impulse');await page.waitForTimeout(2000);
 await helmet.evaluate(e=>e.click());await page.waitForTimeout(80);assert.notEqual(await helmet.evaluate(e=>e.style.transform),'none','assistive activation applies impulse');await page.waitForTimeout(2000);
 await page.emulateMedia({reducedMotion:'reduce'});await helmet.focus();await page.keyboard.press('Enter');await page.waitForTimeout(120);assert.equal(await helmet.evaluate(e=>e.style.transform),'translate3d(0px, 0px, 0px) rotate(0deg) scale(1, 1)');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});await helmet.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await helmet.evaluate(e=>getComputedStyle(e).touchAction),'pan-y');
 const touch=await page.context().newCDPSession(page),box=await helmet.boundingBox();
 const point={x:box.x+box.width/2,y:box.y+box.height/2};
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+70,y:point.y}]});await page.waitForTimeout(250);
 assert.ok(await helmet.evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m41)>5,'touch drag responds');
 const moved=await helmet.boundingBox(),panel=await page.locator('.race-cover-visual').boundingBox();assert.ok(moved.x+moved.width<=panel.x+panel.width,'mobile movement stays inside card');
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();await page.waitForTimeout(2000);
 for(const width of [320,390,768,1440,1920]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow at '+width);}await page.setViewportSize({width:390,height:844});await helmet.scrollIntoViewIfNeeded();await helmet.evaluate(e=>e.blur());await page.screenshot({path:'../../outputs/helmet-mobile.png'});await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(2000);await page.screenshot({path:'../../outputs/helmet-desktop.png'});
 assert.deepEqual(errors,[]);console.log('PASS helmet: bounded drag, spring settling, keyboard impulse, reduced motion, mobile scroll preservation, desktop/mobile screenshots; zero page errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
