/**
 * shots.mjs — render every screen against the mock API and save screenshots.
 * Used to eyeball the UI (and catch runtime errors) without a database.
 *
 *   node mock-server.js &  npx vite preview --port 4173 &  node scripts/shots.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = 'shots';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['landing', '/', false],
  ['login', '/login', false],
  ['register', '/register', false],
  ['discover', '/discover', true],
  ['likes', '/likes', true],
  ['inbox', '/inbox', true],
  ['thread', '/inbox/match/match1', true],
  ['me', '/me', true],
  ['onboarding', '/onboarding?edit=1', true],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const errors = [];

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    viewport: { width: 420, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
  });
  await ctx.addInitScript(() => localStorage.setItem('mm_token', 'mock'));

  for (const [name, path, authed] of PAGES) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${scheme}/${name}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('favicon')) {
        errors.push(`${scheme}/${name}: console ${m.text()}`);
      }
    });
    if (!authed) await page.addInitScript(() => localStorage.removeItem('mm_token'));

    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${scheme}-${name}.png`, fullPage: true });
    await page.close();
  }
  await ctx.close();
}

await browser.close();

if (errors.length) {
  console.log('RUNTIME ERRORS:');
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('All screens rendered cleanly.');
