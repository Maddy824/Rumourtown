import { chromium } from '/Users/maddy/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
const assert=(test,msg)=>{if(!test)throw Error(msg);};
const state={v:2,start:60,seed:731,cast:'v4',interventions:[{tick:61,listener:'mira',claimId:'tom-stole-bread'}]};
async function setup(width,height=800,urlState=state){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:5192/#'+Buffer.from(JSON.stringify(urlState)).toString('base64url'));
 await page.waitForFunction(()=>!!window.rumortown);await page.waitForTimeout(3000);
 const skip=page.locator('.opening').getByRole('button',{name:'Skip',exact:true});if(await skip.isVisible())await skip.click();
 return {page,errors};
}
try{
 for(const [width,height] of [[1280,800],[360,800],[360,640]]){
  const {page,errors}=await setup(width,height);
  await page.locator('.dialogue').waitFor();
  await page.locator('.rt-world').focus();await page.keyboard.press('Space');
  const initial=await page.evaluate(()=>({tick:window.rumortown.sim.tick,tracing:document.querySelector('.rt').dataset.tracing,text:document.querySelector('.dialogue').innerText,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert(initial.tracing==='true','first whisper must auto-follow');
  const firstLine=await page.locator('.dialogue-line').innerText();await page.waitForTimeout(3600);assert(await page.locator('.dialogue-line').innerText()===firstLine,'pause must freeze reading');
  await page.locator('.dialogue-next').click();await page.waitForTimeout(100);assert((await page.locator('.dialogue-script').innerText()).includes('Mira'),'Next must show the reaction');
  await page.locator('.rt-world').focus();await page.keyboard.press('.');
  await page.waitForFunction(()=>window.rumortown.sim.tick>65);await page.waitForTimeout(800);
  const at=await page.evaluate(()=>({tick:window.rumortown.sim.tick,text:document.querySelector('.dialogue').innerText,panel:document.querySelector('.dialogue').getBoundingClientRect().toJSON(),speakers:['mira','rosa'].map(id=>({id,...window.rumortown.locate(id)})),overflow:document.documentElement.scrollWidth>innerWidth,paused:document.querySelector('.speed input:checked').value,postbox:document.querySelector('.quick-whisper').getBoundingClientRect().toJSON()}));
  assert(at.tick===78&&at.paused==='0','Next beat must stop at tick 78');
  assert(!at.overflow,'phone overflow');assert(at.panel.bottom<=at.postbox.top,'dialogue overlaps whisper');
  assert(at.speakers.every(p=>p.y<at.panel.top&&p.y>70&&p.x>0&&p.x<width),'panel covers speakers');
  await page.waitForTimeout(1000);assert(await page.evaluate(()=>window.rumortown.sim.tick)===78,'Next beat advanced after stop');
  await page.screenshot({path:`/Users/maddy/B2B/rumortown/agent-tradeoff/reports/21-${width}x${height}-beat.png`});
  await page.getByRole('button',{name:'Story',exact:true}).click();
  await page.locator('.beat-script summary').first().click();
  const script=await page.locator('.beat-script[open]').first().innerText();assert(script.includes('Mira')&&script.includes('Good.'),'rail must expose full greeting');
  await page.keyboard.press('Escape');
  assert(errors.length===0,errors.join('\n'));results.push({width,height,initial,next:at,script,errors});await page.close();
 }
 const livePage=await setup(360,800);await livePage.page.locator('.dialogue').waitFor();
 await livePage.page.locator('.rt-world').focus();await livePage.page.keyboard.press('Space');
 await livePage.page.getByRole('button',{name:'Whisper',exact:true}).click();
 await livePage.page.locator('input[name="rt-listener"][value="mira"]').check({force:true});
 await livePage.page.locator('label.claim').filter({has:livePage.page.locator('input[value="tom-stole-bread"]')}).click();
 await livePage.page.locator('.whisper').getByRole('button',{name:'Whisper',exact:true}).click();
 await livePage.page.waitForFunction(()=>document.querySelector('.whisper').hidden);
 const live=await livePage.page.evaluate(()=>({ivs:window.rumortown.sim.interventions(),trace:document.querySelector('.rt').dataset.tracing}));
 assert(live.ivs.length===2&&live.trace==='true','live whisper failed');results.push({live,errors:livePage.errors});await livePage.page.close();
 const {page,errors}=await setup(1280,800,{v:2,start:900,seed:731,cast:'v4',interventions:[]});
 await page.locator('.rt-world').focus();await page.keyboard.press('Space');
 const link=await page.evaluate(()=>JSON.parse(atob(location.hash.slice(1).replace(/-/g,'+').replace(/_/g,'/'))));assert(link.start===900&&link.v===2,'arrival share state lost');
 const replay=await page.evaluate(async()=>{
  const [{cast,claims},{villageMap},{createSimulation},{createTalk},{createWorld,createMover}]=await Promise.all([import('/src/content/cast/index.ts'),import('/src/content/map/index.ts'),import('/src/sim/engine.ts'),import('/src/sim/talk/index.ts'),import('/src/sim/world/index.ts')]);
  const sim=createSimulation({seed:731,cast,claims,talk:createTalk(cast),world:{...createWorld(villageMap),createMover},interventions:[{tick:60,listener:'mira',claimId:'tom-stole-bread'}]});while(sim.tick<1440)sim.step();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(sim.events(0))));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 });assert(replay==='6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184','replay changed');
 results.push({link,replay,errors});writeFileSync('/private/tmp/21-browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
