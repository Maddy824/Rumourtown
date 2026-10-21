import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error Node built-ins run in Vitest; the app only has browser typings.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
// @ts-expect-error Node built-ins run in Vitest; the app only has browser typings.
import { tmpdir } from 'node:os';
// @ts-expect-error Node built-ins run in Vitest; the app only has browser typings.
import { join } from 'node:path';
// @ts-expect-error Node built-ins run in Vitest; the app only has browser typings.
import { fileURLToPath } from 'node:url';
// @ts-expect-error Node built-ins run in Vitest; the app only has browser typings.
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = mkdtempSync(join(tmpdir(), 'rumourtown-seo-'));

// Read the static SEO elements without adding a DOM dependency. These documents
// use quoted attributes; script bodies are parsed separately as JSON below.
function elements(html: string, tag: string) {
  const voidTag = tag === 'meta' || tag === 'link';
  const pattern = new RegExp(`<${tag}\\b([^>]*)>${voidTag ? '' : `([\\s\\S]*?)<\\/${tag}\\s*>`}`, 'giu');
  return [...html.matchAll(pattern)].map(match => ({
    attrs: Object.fromEntries([...match[1]!.matchAll(/([\w:-]+)(?:\s*=\s*(["'])(.*?)\2)?/gu)].map(attr => [attr[1], attr[3] ?? ''])),
    text: match[2]?.trim() ?? '',
  }));
}

// Build in a fresh directory: npm test runs before npm run build in CI. Never
// skip these assertions or pass by inspecting a stale checked-out dist folder.
beforeAll(async () => {
  await build({ root, logLevel: 'silent', build: { outDir: output, emptyOutDir: true } });
}, 30_000);
afterAll(() => rmSync(output, { recursive: true, force: true }));

describe.each(['source', 'build'] as const)('%s HTML', location => {
  const read = (page: string) => readFileSync(join(location === 'source' ? root : output, page), 'utf8');

  it('ships browser security headers while allowing the game assets, API and Turnstile', () => {
    const headers = read(location === 'source' ? 'public/_headers' : '_headers');
    const global = headers.split('\n/*\n')[1]!;
    expect(global).toContain('X-Content-Type-Options: nosniff');
    expect(global).toContain('Strict-Transport-Security: max-age=31536000');
    expect(global).toContain('X-Frame-Options: DENY');
    const csp: string = global.split('Content-Security-Policy: ')[1]!.split('\n')[0]!;
    const directives = Object.fromEntries(csp.split(';').map(part => { const [name, ...sources] = part.trim().split(/\s+/u); return [name, sources]; }));
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['script-src']).toEqual(["'self'", 'https://challenges.cloudflare.com', 'https://static.cloudflareinsights.com']);
    expect(directives['connect-src']).toEqual(["'self'", 'https://api.rumourtown.dev', 'https://challenges.cloudflare.com', 'https://cloudflareinsights.com']);
    expect(directives['frame-src']).toEqual(['https://challenges.cloudflare.com']);
    expect(directives['img-src']).toEqual(["'self'", 'data:', 'blob:']);
    for (const directive of ['object-src', 'base-uri', 'frame-ancestors']) expect(directives[directive]).toEqual(["'none'"]);
  });

  it.each([
    ['index.html', 'Rumourtown: a village that gossips', 'https://rumourtown.dev/'],
    ['about.html', 'How Rumourtown works', 'https://rumourtown.dev/about'],
  ])('%s has crawlable content and share metadata', (page, title, canonical) => {
    const html = read(page);
    const metas = elements(html, 'meta');
    const meta = (key: string) => metas.find(({ attrs }) => attrs.name === key || attrs.property === key)?.attrs.content;
    expect(html).toMatch(/<html\s+lang="en"/u);
    expect(elements(html, 'title').map(el => el.text)).toEqual([title]);
    expect(meta('description')?.length).toBeGreaterThan(0);
    expect(meta('description')!.length).toBeLessThan(155);
    expect(elements(html, 'link').filter(el => el.attrs.rel === 'canonical').map(el => el.attrs.href)).toEqual([canonical]);
    expect(meta('viewport')).toContain('viewport-fit=cover');
    expect(meta('theme-color')?.toLowerCase()).toBe('#6b8e4e');
    expect(meta('og:type')).toBe('website');
    expect(meta('og:url')).toBe(canonical);
    expect(meta('og:title')).toBe(title);
    expect(meta('og:description')?.length).toBeGreaterThan(0);
    expect(meta('og:image')).toBe('https://rumourtown.dev/og.jpg');
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    expect(meta('og:image:alt')?.length).toBeGreaterThan(0);
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(elements(html, 'h1').some(el => el.text.includes('Rumourtown'))).toBe(true);
    const data = elements(html, 'script').filter(el => el.attrs.type === 'application/ld+json');
    expect(data.length).toBeGreaterThan(0);
    for (const block of data) expect(JSON.parse(block.text)).toMatchObject({ '@context': 'https://schema.org' });
  });

  it('describes the game, its author and the agent protocol in root JSON-LD', () => {
    const data = elements(read('index.html'), 'script')
      .filter(el => el.attrs.type === 'application/ld+json')
      .map(el => JSON.parse(el.text) as Record<string, unknown>);
    const author = { '@type': 'Person', name: 'Madhav Sunil', sameAs: 'https://github.com/Maddy824' };
    for (const type of ['WebApplication', 'WebSite']) {
      const node = data.find(node => node['@type'] === type);
      expect(node).toMatchObject({ name: 'Rumourtown', url: 'https://rumourtown.dev/', inLanguage: 'en', author,
        keywords: 'agentic game, social simulation, autonomous agents, gossip' });
      expect(node?.description).toMatch(/villagers are autonomous agents/u);
      expect(node?.description).toMatch(/AI agents can play through the agent protocol/u);
    }
    expect(data.find(node => node['@type'] === 'WebApplication')).toMatchObject({
      applicationCategory: 'GameApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript',
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' }, image: 'https://rumourtown.dev/og.jpg',
    });
  });

  it('keeps the supplied FAQ as valid structured questions and answers', () => {
    const data = elements(read('about.html'), 'script')
      .filter(el => el.attrs.type === 'application/ld+json').map(el => JSON.parse(el.text));
    const faq = data.find(node => node['@type'] === 'FAQPage');
    expect(faq.mainEntity).toHaveLength(8);
    for (const question of faq.mainEntity) {
      expect(question).toMatchObject({ '@type': 'Question', name: expect.any(String),
        acceptedAnswer: { '@type': 'Answer', text: expect.any(String) } });
    }
  });

  it('ships visible arrival text, a no-script guide and the font and icon links', () => {
    const html = read('index.html');
    const arrival = elements(html, 'section').find(el => el.attrs.class === 'arrival');
    expect(arrival).toBeDefined();
    expect(arrival!.attrs).not.toHaveProperty('hidden');
    expect(elements(arrival!.text, 'h1')).toHaveLength(1);
    expect(elements(arrival!.text, 'p')[0]?.text).toContain('autonomous villagers');
    const noscript = elements(arrival!.text, 'noscript')[0]!.text;
    expect(noscript).toContain('needs JavaScript');
    expect(elements(noscript, 'a')[0]?.attrs.href).toBe('/about');
    const links = elements(html, 'link').map(el => el.attrs);
    expect(links).toEqual(expect.arrayContaining([
      expect.objectContaining({ rel: 'preload', href: '/fonts/BricolageGrotesque-latin.woff2', as: 'font', type: 'font/woff2' }),
      expect.objectContaining({ rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' }),
      expect.objectContaining({ rel: 'icon', href: '/favicon-32.png', sizes: '32x32' }),
      expect.objectContaining({ rel: 'icon', href: '/icon-192.png', sizes: '192x192' }),
      expect.objectContaining({ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }),
      expect.objectContaining({ rel: 'manifest', href: '/manifest.webmanifest' }),
    ]));
    expect(html).toMatch(/<link\b[^>]*rel="preload"[^>]*\bcrossorigin(?:[\s=>])/u);
  });
});

it('copies robots.txt and sitemap.xml into a fresh production build', () => {
  for (const file of ['robots.txt', 'sitemap.xml']) expect(existsSync(join(output, file))).toBe(true);
  expect(readFileSync(join(output, 'robots.txt'), 'utf8')).toContain('Sitemap: https://rumourtown.dev/sitemap.xml');
  const sitemap = readFileSync(join(output, 'sitemap.xml'), 'utf8');
  expect(sitemap).toContain('<loc>https://rumourtown.dev/</loc>');
  expect(sitemap).toContain('<loc>https://rumourtown.dev/about</loc>');
});

it('keeps production JavaScript and CSS below 400 KB gzipped', () => {
  const files: string[] = readdirSync(output, { recursive: true }).filter((file: string) => /\.(?:js|css)$/u.test(file));
  expect(files.length).toBeGreaterThan(0);
  const bytes = files.reduce((sum, file) => sum + gzipSync(readFileSync(join(output, file)), { level: 9 }).byteLength, 0);
  expect(bytes).toBeLessThan(400_000);
});
