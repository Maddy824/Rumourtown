import { chromium } from '/Users/maddy/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
 for(const width of [1280,360]){
  const page=await browser.newPage({viewport:{width,height:800}});page.setDefaultTimeout(20000);
  const errors=[],interpret=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/interpret'))interpret.push(r.url());});
  await page.route('**/*interpret*',r=>r.abort());
  const state={v:2,start:60,seed:731,cast:'v4',interventions:[{tick:61,listener:'mira',claimId:'tom-stole-bread'}]};
  const response=await page.goto('https://rumourtown.dev/#'+Buffer.from(JSON.stringify(state)).toString('base64url'));
  await page.waitForTimeout(3100);
  const skip=page.locator('.opening').getByRole('button',{name:'Skip',exact:true});if(await skip.isVisible())await skip.click();
  await page.locator('.dialogue').waitFor();
  if(width===360)await page.getByRole('button',{name:/^Time controls/}).click();
  await page.locator('label.speed-option[data-speed="0"]').click();
  await page.getByRole('button',{name:'Next beat',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.clock-time')?.textContent==='07:18');
  await page.waitForTimeout(800);
  const result=await page.evaluate(()=>({clock:document.querySelector('.clock-time').textContent,script:document.querySelector('script[type="module"]').getAttribute('src'),dialogue:document.querySelector('.dialogue').innerText,paused:document.querySelector('.speed input:checked').value,tracing:document.querySelector('.rt').dataset.tracing,overflow:document.documentElement.scrollWidth>innerWidth,devHandle:typeof window.rumortown}));
  if(response.status()!==200||result.script!=='/assets/main-DRCYzOob.js'||result.paused!=='0'||result.overflow||!result.dialogue.includes('Mira tell Rosa')||errors.length||interpret.length)throw Error(JSON.stringify({result,errors,interpret}));
  await page.screenshot({path:`/Users/maddy/B2B/rumortown/agent-tradeoff/reports/21-live-${width}.png`});
  results.push({width,status:response.status(),...result,errors,interpretRequests:interpret.length});await page.close();
 }
 writeFileSync('/private/tmp/21-live-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
