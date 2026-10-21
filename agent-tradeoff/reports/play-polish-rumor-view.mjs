// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright module. Preview: port 5193.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], assert = (value, message) => { if (!value) throw Error(message); };
try {
  for (const width of [1280, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    const state = { v: 2, start: 60, seed: 731, cast: 'v4', interventions: [{ tick: 61, listener: 'mira', claimId: 'tom-stole-bread' }] };
    await page.goto('http://127.0.0.1:5193/#' + Buffer.from(JSON.stringify(state)).toString('base64url'));
    await page.getByRole('button', { name: 'Enter village', exact: true }).click();
    await page.getByRole('button', { name: 'Start exploring', exact: true }).click();
    await page.waitForFunction(() => rumortown.sim.tick >= 63);
    assert(await page.locator('.dialogue').isHidden(), 'Natural view unexpectedly reads a scene');
    assert(await page.locator('.beat-thread').getAttribute('d') === '', 'Default has a rumor line');
    await page.locator('.rt-world').focus(); await page.keyboard.press('Space');
    await page.keyboard.press('.'); await page.locator('.dialogue').waitFor();
    const scene = await page.evaluate(() => ({ tick: rumortown.sim.tick, topic: document.querySelector('.dialogue-topic').textContent, header: document.querySelector('.dialogue-heading').textContent, text: document.querySelector('.dialogue-line').textContent, overflow: document.documentElement.scrollWidth > innerWidth }));
    assert(scene.tick === 78 && !scene.overflow, JSON.stringify(scene));
    await page.locator('.dialogue-next').click();
    await page.waitForFunction(() => document.querySelector('.dialogue-topic').textContent.includes('Tom'));
    await page.screenshot({ path: `/private/tmp/rumor-view-${width}.png` });
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Rumor lines: off', exact: true }).click();
    await page.getByRole('button', { name: 'Close tools', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.beat-thread').getAttribute('d') !== '');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Read conversations: off', exact: true }).click();
    await page.getByRole('button', { name: 'Read conversations: on', exact: true }).click();
    await page.getByRole('button', { name: 'Close tools', exact: true }).click();
    assert(await page.locator('.dialogue').isHidden(), 'Turning reading off did not clear scene');
    const hash = width === 1280 ? await page.evaluate(async () => {
      const [{ cast, claims }, { villageMap }, { createSimulation }, { createTalk }, { createWorld, createMover }] = await Promise.all([import('/src/content/cast/index.ts'), import('/src/content/map/index.ts'), import('/src/sim/engine.ts'), import('/src/sim/talk/index.ts'), import('/src/sim/world/index.ts')]);
      const sim = createSimulation({ seed: 731, cast, claims, talk: createTalk(cast), world: { ...createWorld(villageMap), createMover }, interventions: [{ tick: 60, listener: 'mira', claimId: 'tom-stole-bread' }] });
      while (sim.tick < 1440) sim.step();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sim.events(0))));
      return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }) : undefined;
    if (hash) assert(hash === '6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184', 'Replay changed');
    assert(!errors.length, JSON.stringify(errors)); results.push({ width, scene, hash, errors }); await page.close();
  }
  writeFileSync('/private/tmp/rumor-view-results.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
