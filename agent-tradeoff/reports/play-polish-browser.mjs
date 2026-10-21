// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright module. Preview: port 5193.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], assert = (ok, message) => { if (!ok) throw Error(message); };
try {
  for (const [width, height] of [[1280, 800], [360, 800], [360, 640]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' }); page.setDefaultTimeout(12000);
    const errors = [], requests = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      let callback;
      window.turnstile = { render(_el, opts) { callback = opts.callback; return 'test-widget'; }, execute() { queueMicrotask(() => callback('test-token')); }, reset() {}, remove() {} };
    });
    await page.route('**/*', r => {
      const url = new URL(r.request().url());
      if (url.pathname === '/play') {
        const body = r.request().postDataJSON(); requests.push(body);
        if (body.text === 'budget') return r.fulfill({ status: 503, json: { reason: 'budget' } });
        return r.fulfill({ json: body.text === 'kill' ? { reply: 'What do you mean? Tell me what happened first.', action: 'none', target: '' } : { reply: 'We can walk to the square and see who is there.', action: 'move', target: 'square' } });
      }
      return url.hostname === '127.0.0.1' ? r.continue() : r.abort();
    });
    await page.goto('http://127.0.0.1:5193/?t=60'); await page.waitForFunction(() => !!window.rumortown);
    await page.waitForTimeout(3200);
    const waiting = await page.evaluate(() => ({ tick: rumortown.sim.tick, hidden: document.querySelector('.arrival').hidden, hint: document.querySelector('.arrival-hint').textContent, overflow: document.documentElement.scrollWidth > innerWidth }));
    assert(waiting.tick === 60 && !waiting.hidden && !waiting.overflow && !waiting.hint.includes('Click'), JSON.stringify(waiting));
    await page.screenshot({ path: `/private/tmp/angelic-${width}x${height}.png` });
    await page.getByRole('button', { name: 'Enter village', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Start exploring', exact: true }).click();
    await page.getByRole('button', { name: 'Talk or act', exact: true }).click();
    assert(await page.locator('.play-sheet').isVisible(), 'Conversation invisible');
    const input = page.getByLabel('Your words', { exact: true });
    await input.fill('kill'); await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText('What do you mean? Tell me what happened first.', { exact: false }).waitFor();
    assert(requests[0].text === 'kill', 'Text rewritten');
    assert(await page.locator('.play-turn button').count() === 0, 'Ambiguous text caused action');
    await input.fill('Walk to the square'); await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.locator('.play-turn button').waitFor();
    assert(requests[1].context.history[0].you === 'kill', 'History missing');
    const before = await page.evaluate(() => ({ tick: rumortown.sim.tick, pos: rumortown.sim.snapshot().player.pos, overflow: document.documentElement.scrollWidth > innerWidth, rect: document.querySelector('.play-sheet').getBoundingClientRect().toJSON() }));
    assert(!before.overflow && before.rect.x >= 0 && before.rect.right <= width, JSON.stringify(before));
    await page.screenshot({ path: `/private/tmp/play-${width}x${height}.png` });
    await page.locator('.play-turn button').click(); await page.waitForFunction(() => document.querySelector('.play-sheet').hidden);
    await page.getByRole('button', { name: 'Talk or act', exact: true }).click();
    await input.fill('budget'); await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText('The shared AI allowance is resting.', { exact: false }).waitFor();
    assert(await page.locator('.play-turn').count() === 0, 'Budget failure invented reply');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Rumor lines: off', exact: true }).click();
    assert(await page.locator('.rt').getAttribute('data-rumor-lines') === 'true', 'Trail toggle failed');
    await page.getByRole('button', { name: 'Rumor lines: on', exact: true }).click();
    await page.getByRole('button', { name: 'Read conversations: off', exact: true }).click();
    await page.getByRole('button', { name: 'Read conversations: on', exact: true }).click();
    await page.getByRole('button', { name: 'Quiet music', exact: true }).focus(); await page.keyboard.press('Space');
    assert(await page.evaluate(() => localStorage.getItem('rumourtown-music-muted')) === 'true', 'Keyboard mute failed');
    assert(errors.length === 0, JSON.stringify(errors));
    results.push({ width, height, waiting, before, requests: requests.map(r => ({ text: r.text, speaker: r.context.speaker, history: r.context.history.length })), errors }); await page.close();
  }
  writeFileSync('/private/tmp/play-results.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
