import { writeFileSync } from 'node:fs';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const engine = process.env.BROWSER ?? 'chromium';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5196';
const prefix = process.env.EVIDENCE_PREFIX ?? 'mobile-stability';
const shared = Buffer.from(JSON.stringify({ v: 2, start: 600, seed: 731, cast: 'v4', interventions: [] })).toString('base64url');
const assert = (ok, why) => { if (!ok) throw Error(why); };
const browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const profile of [{ width: 390, height: 844, dpr: 3, cpu: 4 }, { width: 360, height: 640, dpr: 3, cpu: 4 }, { width: 1280, height: 800, dpr: 2, cpu: 1 }]) {
    const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr, isMobile: profile.width < 760, hasTouch: profile.width < 760 });
    const errors = []; page.on('console', message => { if (message.text().includes('renderer failed')) errors.push(message.text()); }); page.on('pageerror', e => errors.push(e.message)); page.on('crash', () => errors.push('page crashed'));
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await page.addInitScript(() => {
      const refs = [], create = document.createElement.bind(document);
      document.createElement = function(tag, ...args) { const el = create(tag, ...args); if (tag.toLowerCase() === 'canvas') refs.push(new WeakRef(el)); return el; };
      window.mobileProbe = () => {
        let pixels = 0, count = 0;
        for (const ref of refs) { const c = ref.deref(); if (c?.width && c?.height) { count++; pixels += c.width * c.height; } }
        return { count, rgbaMiB: pixels * 4 / 1048576, created: refs.length, screen: [document.querySelector('.rt-world')?.width, document.querySelector('.rt-world')?.height] };
      };
    });
    const cdp = engine === 'webkit' ? { send: async () => {} } : await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    await page.goto(`${base}/#${shared}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('button', { name: 'Enter village', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Explore on my own', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.stitching')?.hidden, null, { timeout: 60000 });
    await page.waitForTimeout(3000); await cdp.send('HeapProfiler.collectGarbage');
    const initial = await page.evaluate(() => mobileProbe());
    const unchanged = await page.evaluate(() => {
      const before = mobileProbe().created;
      for (let i = 0; i < 30; i++) window.visualViewport.dispatchEvent(new Event('resize'));
      return mobileProbe().created - before;
    });
    assert(unchanged === 0, 'Unchanged viewport rebuilt canvases');
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Talk', exact: true }).click();
      await page.locator('#rt-play-input').fill('Hello, how is the village today?');
      await page.setViewportSize({ width: profile.width, height: profile.height - 180 });
      await page.waitForTimeout(300);
      await page.setViewportSize({ width: profile.width, height: profile.height });
      await page.getByRole('button', { name: 'Close conversation', exact: true }).click();
      await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.keyboard.press('Escape');
    }
    if (profile.width < 760) {
      await page.setViewportSize({ width: profile.height, height: profile.width }); await page.waitForTimeout(3000);
      await page.setViewportSize({ width: profile.width, height: profile.height });
    }
    const beforeRun = await page.locator('.time-ribbon input[type=range], .ribbon-input').first().inputValue();
    await page.locator('.rt-world').focus(); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(15000);
    const afterRun = await page.locator('.time-ribbon input[type=range], .ribbon-input').first().inputValue();
    assert(Number(afterRun) > Number(beforeRun), 'Simulation stopped progressing');
    await cdp.send('HeapProfiler.collectGarbage');
    const final = await page.evaluate(() => ({ ...mobileProbe(), overflow: document.documentElement.scrollWidth > innerWidth }));
    assert(!final.overflow, 'Horizontal overflow');
    if (profile.width < 760) assert(final.rgbaMiB < 100, 'Phone retained over 100 MiB in canvas backing buffers');
    assert(errors.length === 0, JSON.stringify(errors));
    await page.screenshot({ path: `agent-tradeoff/reports/${prefix}-${profile.width}.png` });
    results.push({ base, engine, profile: { ...profile, cpu: engine === 'webkit' ? 1 : profile.cpu }, initial, final, unchangedResizeAllocations: unchanged, beforeRun, afterRun, errors });
    await page.close();
  }
  writeFileSync(`agent-tradeoff/reports/${prefix}-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
