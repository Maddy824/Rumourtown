import { chromium } from '/Users/maddy/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({channel:'chrome',headless:true});
const results = [];
try {
 for (const width of [1280,360]) {
  const page = await browser.newPage({viewport:{width,height:800}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:5192/?t=1020');
  await page.waitForFunction(()=>!!window.rumortown);
  const arrivalNight = await page.locator('.arrival').getAttribute('data-night');
  await page.waitForTimeout(3200);
  for (const name of ['Skip','Let me try','Got it','Start exploring','Explore the village','Close']) {
   const button=page.getByRole('button',{name,exact:true}); if (await button.count() && await button.first().isVisible()) await button.first().click();
  }
  await page.keyboard.press('Space');
  const pause=page.getByRole('button',{name:'Pause',exact:true}); if(await pause.isVisible()) await pause.click();
  await page.waitForFunction(()=>{const c=document.querySelector('.rt-world');const p=c.getContext('2d').getImageData(100,100,1,1).data;return p[0]+p[1]+p[2]>0;});
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,night:document.querySelector('.district-banner')?.dataset.night,now:document.querySelector('.now-copy')?.textContent,tick:window.rumortown.sim.tick}));
  await page.screenshot({path:`/Users/maddy/B2B/rumortown/agent-tradeoff/reports/22-${width===360?'phone':'desktop'}-night.png`});
  const whisper=page.getByRole('button',{name:/^Whisper/}).first();
  await whisper.click();
  const sheet=page.locator('.whisper'); await sheet.waitFor();
  await page.screenshot({path:`/private/tmp/22-${width}-whisper.png`});
  await page.keyboard.press('Escape'); await page.waitForFunction(()=>document.querySelector('.whisper').hidden);
  const keyboard=await page.evaluate(()=>({focus:document.activeElement?.getAttribute('aria-label')??document.activeElement?.textContent,sheetHidden:document.querySelector('.whisper')?.hidden}));
  results.push({width,arrivalNight,layout,keyboard,errors});
  if (layout.overflow||errors.length||arrivalNight!=='true'||!keyboard.sheetHidden) throw Error(JSON.stringify(results));
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto('http://127.0.0.1:5192/?t=1020'); await page.waitForFunction(()=>!!window.rumortown);
 const replay=await page.evaluate(async()=>{
  window.rumortown.destroy();
  const [{cast,claims},{villageMap},{createSimulation},{createTalk},{createWorld,createMover}]=await Promise.all([import('/src/content/cast/index.ts'),import('/src/content/map/index.ts'),import('/src/sim/engine.ts'),import('/src/sim/talk/index.ts'),import('/src/sim/world/index.ts')]);
  const sim=createSimulation({seed:731,cast,claims,talk:createTalk(cast),world:{...createWorld(villageMap),createMover},interventions:[{tick:60,listener:'mira',claimId:'tom-stole-bread'}]});
  while(sim.tick<1020)sim.step(); const snapshot=sim.snapshot();
  while(sim.tick<1440)sim.step();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(sim.events(0))));
  window.nightSnapshot=snapshot; window.nightMap=villageMap;
  return {hash:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),events:sim.events(0).length};
 });
 const frames=await page.evaluate(async()=>{
  const {createRenderer}=await import('/src/render/index.ts');
  const canvas=document.createElement('canvas');canvas.style.width='1280px';canvas.style.height='800px';document.body.append(canvas);
  const renderer=createRenderer(canvas,window.nightMap); renderer.resize(1280,800,1);
  const inn=window.nightMap.places.find(p=>p.id==='inn');
  const camera={center:{x:inn.rect.x+2,y:inn.rect.y+2},zoom:40,width:1280,height:800};
  let ready=false; const samples=[];const options={alpha:1,threads:false,reducedMotion:false,onReady:()=>{ready=true;}};
  for(let i=0;i<240;i++) {await new Promise(requestAnimationFrame); const start=performance.now();renderer.render(null,window.nightSnapshot,camera,options);const elapsed=performance.now()-start;if(ready&&i>60)samples.push(elapsed);}
  const flushed=[]; for(let i=0;i<60;i++){const start=performance.now();renderer.render(null,window.nightSnapshot,camera,options);canvas.getContext('2d').getImageData(0,0,1,1);flushed.push(performance.now()-start);} flushed.sort((a,b)=>a-b); samples.sort((a,b)=>a-b);return {count:samples.length,p50:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)],max:samples.at(-1),flushedP95:flushed[Math.floor(flushed.length*.95)]};
 });
 results.push({replay,frames});
 if(replay.hash!=='6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184'||!frames.count||frames.p95>4)throw Error(JSON.stringify(results));
 writeFileSync('/private/tmp/22-browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
