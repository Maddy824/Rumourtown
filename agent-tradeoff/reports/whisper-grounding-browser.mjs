// Production-build smoke: exact reported input, keyboard recovery and narrow screens.
import { writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5194';
const prefix = process.env.EVIDENCE_PREFIX ?? 'whisper-grounding';
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
    await page.locator('#rt-own-story').fill('someone killed tom');
    await page.getByRole('button', { name: 'Whisper', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.whisper-feedback').textContent.includes("Death rumors aren't supported yet"));
    assert(await page.locator('.whisper-confirmation').isHidden(), 'Unrelated confirmation shown');
    assert(await page.getByRole('button', { name: 'Whisper', exact: true }).isDisabled(), 'Rejected rumor can be sent');
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      sheet: document.querySelector('.whisper').getBoundingClientRect().toJSON(),
      button: document.querySelector('.whisper-actions button[type=submit]').getBoundingClientRect().toJSON() }));
    assert(!layout.overflow && layout.sheet.x >= 0 && layout.sheet.right <= width, 'Sheet overflows');
    assert(layout.button.y >= 0 && layout.button.bottom <= height, 'Whisper button outside viewport');
    const rejectedState = JSON.parse(Buffer.from(new URL(page.url()).hash.slice(1), 'base64url').toString());
    assert(rejectedState.interventions.length === 1, 'Rejected story entered replay');
    await page.screenshot({ path: `agent-tradeoff/reports/${prefix}-${width}x${height}.png` });
    await page.locator('#rt-own-story').fill('Tom stole bread');
    await page.getByRole('button', { name: 'Whisper', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Whisper it', exact: true }).waitFor();
    assert((await page.locator('.whisper-confirmation').textContent()).includes('Tom stole bread'), 'Edit did not recover confirmation');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.whisper').hidden);
    const shared = JSON.parse(Buffer.from(new URL(page.url()).hash.slice(1), 'base64url').toString());
    assert(shared.interventions.length === 2 && shared.interventions[1].claimId === 'typed_theft_tom_none_bread_2', 'Corrected rumor not sent');
    assert(!JSON.stringify(shared).includes('killed'), 'Rejected input leaked into replay');
    assert(inference.length === 0, 'Local guard made an inference request');
    assert(errors.length === 0, JSON.stringify(errors));
    results.push({ base, width, height, layout, inference, errors, rejectedInputNotShared: true, keyboardRecovery: true });
    await page.close();
  }
  writeFileSync(`agent-tradeoff/reports/${prefix}-browser-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
