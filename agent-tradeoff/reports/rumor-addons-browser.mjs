// Run against a production build with BASE_URL and PLAYWRIGHT_MODULE set.
import { writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5194';
const state = Buffer.from(JSON.stringify({ v: 1, seed: 731, cast: 'v4',
  interventions: [{ tick: 0, listener: 'mira', claimId: 'tom-stole-bread' }] })).toString('base64url');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const assert = (condition, message) => { if (!condition) throw Error(message); };
try {
  for (const [width, height] of [[1280, 800], [360, 800], [360, 640]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const errors = [], inference = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['/interpret', '/play'].includes(url.pathname)) inference.push(url.pathname);
      return url.origin === new URL(base).origin ? route.continue() : route.abort();
    });
    await page.goto(`${base}/#${state}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByRole('button', { name: 'Enter village', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Start exploring', exact: true }).click();
    await page.getByRole('button', { name: 'Talk or act', exact: true }).click();
    await page.getByRole('button', { name: 'Spread a rumor', exact: true }).click();
    const library = page.locator('.rumor-library');
    await library.locator('summary').focus(); await page.keyboard.press('Enter');
    assert(await library.getAttribute('open') !== null, 'Library could not be opened with keyboard');
    await page.getByLabel('Story collection').selectOption('quiet-kindness');
    await page.getByLabel('Rumor idea').selectOption('winter-coat');
    const sentence = 'Ada secretly mended Ben’s winter coat and left it folded by his door';
    assert(await page.locator('.rumor-library-preview').textContent() === sentence, 'Full sentence lost');
    await page.getByRole('button', { name: 'Choose this rumor', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('.whisper-feedback').textContent() === 'Selected from the library. No AI credits used.', 'Missing usage notice');
    assert(await page.getByRole('button', { name: 'Whisper', exact: true }).evaluate(el => el === document.activeElement), 'Focus did not move to Whisper');
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      sheet: document.querySelector('.whisper').getBoundingClientRect().toJSON(),
      button: document.querySelector('.whisper-actions button[type=submit]').getBoundingClientRect().toJSON() }));
    assert(!layout.overflow && layout.sheet.x >= 0 && layout.sheet.right <= width, 'Sheet overflows');
    assert(layout.button.y >= 0 && layout.button.bottom <= height, 'Whisper button outside viewport');
    await page.screenshot({ path: `agent-tradeoff/reports/rumor-addons-${width}x${height}.png` });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.whisper').hidden);
    const shared = JSON.parse(Buffer.from(new URL(page.url()).hash.slice(1), 'base64url').toString());
    const selected = shared.interventions.find(item => item.claimId.startsWith('written_'));
    assert(selected, 'Story missing from replay');
    const decoded = JSON.parse(Buffer.from(selected.claimId.slice(8), 'base64url').toString());
    assert(decoded[0] === sentence, 'Replay does not preserve story');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Developer guide', exact: true }).click();
    await page.getByRole('link', { name: 'Build a rumor or behavior add-on', exact: true }).scrollIntoViewIfNeeded();
    assert(await page.getByRole('link', { name: 'Build a rumor or behavior add-on', exact: true }).isVisible(), 'Add-on guide missing');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Developer guide overflows');
    assert(inference.length === 0, 'Library made a model request');
    assert(errors.length === 0, JSON.stringify(errors));
    results.push({ width, height, sentence, layout, inference, errors, replayPreserved: true });
    await page.close();
  }
  writeFileSync('agent-tradeoff/reports/rumor-addons-browser-results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
