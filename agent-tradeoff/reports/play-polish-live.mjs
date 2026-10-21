// The desktop case attempts one real AI request under the production caps.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], assert = (ok, message) => { if (!ok) throw Error(message); };
try {
  for (const width of [1280, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(15000);
    const errors = [], replies = []; let playRequests = 0;
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().endsWith('/play') && r.method() === 'POST') playRequests++; });
    page.on('response', async r => { if (r.url().endsWith('/play') && r.request().method() === 'POST') replies.push({ status: r.status(), body: await r.json().catch(() => null) }); });
    await page.addInitScript(() => {
      window.audioChecks = []; const Native = window.AudioContext;
      window.AudioContext = class extends Native { constructor(...args) { super(...args); window.audioChecks.push(this); } };
    });
    await page.goto('https://rumourtown.dev/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    const waiting = await page.evaluate(() => ({ visible: !document.querySelector('.arrival').hidden, playing: document.querySelector('.arrival').classList.contains('arrival-playing'), audio: audioChecks.length, overflow: document.documentElement.scrollWidth > innerWidth, asset: document.querySelector('script[type="module"]').getAttribute('src'), devHandle: typeof window.rumortown }));
    assert(waiting.visible && !waiting.playing && !waiting.audio && !waiting.overflow && waiting.devHandle === 'undefined' && waiting.asset === '/assets/main-D9ThIpih.js', JSON.stringify(waiting));
    await page.screenshot({ path: `/private/tmp/play-live-landing-${width}.png` });
    await page.getByRole('button', { name: 'Enter village', exact: true }).click();
    await page.getByRole('button', { name: 'Start exploring', exact: true }).click();
    await page.waitForFunction(() => audioChecks[0]?.state === 'running');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Quiet music', exact: true }).click();
    await page.waitForFunction(() => audioChecks[0]?.state === 'suspended');
    await page.getByRole('button', { name: 'Rumor lines: off', exact: true }).click();
    await page.getByRole('button', { name: 'Rumor lines: on', exact: true }).click();
    await page.getByRole('button', { name: 'Close tools', exact: true }).click();
    await page.getByRole('button', { name: 'Talk or act', exact: true }).click();
    let status = 'Conversation opened; no AI request sent.';
    if (width === 1280) {
      await page.getByLabel('Your words', { exact: true }).fill('kill');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.play-form').hasAttribute('aria-busy'), { timeout: 35000 });
      status = await page.locator('.play-status').innerText();
    }
    assert(playRequests <= 1, 'Unexpected repeated inference');
    const end = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, reply: document.querySelector('.play-transcript').innerText, actionButtons: document.querySelectorAll('.play-turn button').length }));
    assert(!end.overflow, 'Live overflow');
    if (replies[0]?.status === 200) assert(replies[0].body.action === 'none' && end.actionButtons === 0, 'Ambiguous command proposed an action');
    await page.screenshot({ path: `/private/tmp/play-live-${width}.png` });
    results.push({ width, waiting, status, playRequests, replies, end, errors }); await page.close();
  }
  writeFileSync('/private/tmp/play-live-results.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
