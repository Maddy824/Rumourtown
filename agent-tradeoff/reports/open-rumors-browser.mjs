import { writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5194';
const mock = new URL(base).hostname === '127.0.0.1';
const prefix = process.env.EVIDENCE_PREFIX ?? 'open-rumors';
const state = Buffer.from(JSON.stringify({ v: 1, seed: 731, cast: 'v4', interventions: [{ tick: 0, listener: 'mira', claimId: 'tom-stole-bread' }] })).toString('base64url');
const assert = (ok, why) => { if (!ok) throw Error(why); };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const [width, height] of [[1280, 800], [360, 800], [360, 640]]) {
    for (const story of ['someone killed tom', 'The moon is made of cheese']) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      if (mock) await page.addInitScript(() => {
        let callback;
        window.turnstile = { render(_el, options) { callback = options.callback; return 'test-widget'; },
          execute() { queueMicrotask(() => callback('test-token')); }, reset() {}, remove() {} };
      });
      const meaning = { actor: null, affected: story.includes('tom') ? 'tom' : null, valence: 0, severity: story.includes('tom') ? 3 : 2,
        question: story.includes('tom') ? 'Who saw what happened to Tom?' : 'How could anyone check that?' };
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (mock && url.pathname === '/rumor') {
          requests.push(route.request().postDataJSON());
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(meaning), headers: { 'Access-Control-Allow-Origin': new URL(base).origin } });
        }
        return url.origin === new URL(base).origin ? route.continue() : route.abort();
      });
      await page.goto(`${base}/#${state}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Enter village', exact: true }).focus(); await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Start exploring', exact: true }).click();
      await page.getByRole('button', { name: 'Talk or act', exact: true }).click();
      await page.getByRole('button', { name: 'Spread a rumor', exact: true }).click();
      await page.locator('#rt-own-story').fill(story);
      await page.getByRole('button', { name: 'Whisper', exact: true }).focus(); await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Whisper it', exact: true }).waitFor({ timeout: 20000 });
      const confirmation = await page.locator('.whisper-confirmation').textContent();
      assert(confirmation.includes(story) && confirmation.includes('shared replay links'), 'Missing exact text or disclosure');
      assert(confirmation.includes('Actor: Unknown or not stated'), 'Invented actor');
      assert(confirmation.includes('No reputation judgment.') && confirmation.includes('Importance:'), 'Hidden social annotations');
      assert(!confirmation.includes('Rosa') && !confirmation.includes('Ada'), 'Unrelated people inserted');
      assert(JSON.parse(Buffer.from(new URL(page.url()).hash.slice(1), 'base64url')).interventions.length === 1, 'Published before confirmation');
      await page.locator('.whisper-confirmation').scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
        button: document.querySelector('.whisper-actions button[type=submit]').getBoundingClientRect().toJSON() }));
      assert(!layout.overflow && layout.button.y >= 0 && layout.button.bottom <= height, 'Layout overflow or hidden submit');
      await page.screenshot({ path: `agent-tradeoff/reports/${prefix}-${width}x${height}-${story.includes('tom') ? 'tom' : 'moon'}.png` });
      await page.getByRole('button', { name: 'Whisper it', exact: true }).focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.whisper').hidden);
      const shared = JSON.parse(Buffer.from(new URL(page.url()).hash.slice(1), 'base64url'));
      const id = shared.interventions[1].claimId;
      assert(id.startsWith('story_'), 'Not an open story');
      const data = JSON.parse(Buffer.from(id.slice(6), 'base64url'));
      assert(data[0] === story && data[1] === null && data[3] === 0, 'Story rewritten or victim blamed');
      if (mock) assert(data[2] === meaning.affected && requests.length === 1 && requests[0].text === story, 'Semantic path failed');
      else assert(requests.length === 0, 'Live check used inference');
      assert(errors.length === 0, JSON.stringify(errors));
      results.push({ base, width, height, story, mode: mock ? 'mocked inference' : 'live free fallback', layout, decodedStory: data, errors });
      await page.close();
    }
  }
  writeFileSync(`agent-tradeoff/reports/${prefix}-browser-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
