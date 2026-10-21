import { chromium } from '/Users/maddy/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
 for(const hour of [19,0]){
  const page=await browser.newPage();await page.addInitScript(hour=>{const RealDate=Date;window.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[2026,9,21,hour,0]));}};},hour);
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:5192/');await page.waitForFunction(()=>!!window.rumortown);
  const r=await page.evaluate(()=>({tick:window.rumortown.sim.tick,minute:window.rumortown.sim.snapshot().minuteOfDay,night:document.querySelector('.arrival').dataset.night}));
  if(r.minute!==hour*60)throw Error(JSON.stringify(r));results.push({hour,...r});await page.close();
 }
 const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const pending=new Map();let id=0,now=performance.now();window.requestAnimationFrame=f=>{pending.set(++id,f);return id;};window.cancelAnimationFrame=i=>pending.delete(i);
  window.testFrames=(count)=>{for(let n=0;n<count;n++){now+=500;const batch=[...pending.values()];pending.clear();for(const f of batch)f(now);}};
 });
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const state={v:2,start:60,seed:731,cast:'v4',interventions:[]};await page.goto('http://127.0.0.1:5192/#'+Buffer.from(JSON.stringify(state)).toString('base64url'));
 await page.waitForFunction(()=>!!window.rumortown);await page.waitForTimeout(3100);await page.locator('.opening').getByRole('button',{name:'Skip',exact:true}).click();
 await page.evaluate(()=>{const i=document.querySelector('.speed input[value="8"]');i.checked=true;i.dispatchEvent(new Event('change'));});
 const stops=[];
 for(let n=0;n<9;n++){
  await page.evaluate(()=>window.testFrames(200));
  const r=await page.evaluate(()=>({tick:window.rumortown.sim.tick,title:document.querySelector('.dayend-title').textContent,stats:document.querySelector('.story-stats')?.textContent,open:!document.querySelector('.dayend').hidden,minute:window.rumortown.sim.snapshot().minuteOfDay}));
  if(r.open){stops.push(r);if(r.tick===4380)break;await page.getByRole('button',{name:'Keep going',exact:true}).click();}
 }
 await page.evaluate(()=>window.testFrames(50));const finalTick=await page.evaluate(()=>window.rumortown.sim.tick);
 if(finalTick!==4380||errors.length)throw Error(JSON.stringify({finalTick,stops,errors}));
 results.push({stops,finalTick,errors});writeFileSync('/private/tmp/21-clock-end-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
