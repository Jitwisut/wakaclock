/**
 * Asserts that the production prerender actually contains the elements the marketing
 * pages are supposed to ship.
 *
 * This exists because of a defect that neither Vitest nor the dev server can see: with
 * the homepage's JSON-LD block rendered before the content, the built English homepage
 * came out missing its primary hero CTA, while the same component rendered correctly in
 * `renderToStaticMarkup`, in `next dev`, and on the Thai route. The fix (rendering
 * JSON-LD last — see components/marketing/marketing-home-page.tsx) is invisible to every
 * other gate in this repo, so this reads the built HTML instead.
 *
 * Run after `next build`:  node scripts/check-prerender.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = '.next/server/app';

const PUBLIC_ROUTES = [
  '/',
  '/teams',
  '/wakatime-alternative',
  '/ai-coding-tracker',
  '/ai-cost-tracking',
  '/developer-analytics',
  '/integrations',
  '/integrations/vscode',
  '/pricing',
  '/privacy',
  '/docs',
  '/docs/getting-started',
  '/docs/how-coding-time-is-calculated',
  '/docs/ai-attribution-and-coverage',
  '/docs/ai-cost-methodology',
  '/about',
  '/contact',
  '/terms',
  '/early-access',
  '/join',
];

/** Keep the built HTML contract in step with the public route inventory. */
const EXPECTATIONS = [
  ...PUBLIC_ROUTES.map((route) => ({ locale: 'en', route })),
  ...PUBLIC_ROUTES.map((route) => ({ locale: 'th', route })),
];

function htmlPath(route, locale) {
  const localizedRoute = locale === 'th' ? `/th${route === '/' ? '' : route}` : route;
  return join(APP_DIR, localizedRoute === '/' ? 'index.html' : `${localizedRoute}.html`);
}

function absolutePath(origin, route, locale) {
  const localizedRoute = locale === 'th' ? `/th${route === '/' ? '' : route}` : route;
  return new URL(localizedRoute || '/', origin).toString().replace(/\/$/, localizedRoute ? '' : '');
}

function matchOne(html, pattern) {
  const match = html.match(pattern);
  return match?.[1] ?? null;
}

if (!existsSync(APP_DIR)) {
  console.error(`No build found at ${APP_DIR}. Run \`next build\` first.`);
  process.exit(1);
}

const failures = [];
const originFromHome = (() => {
  const homePath = join(APP_DIR, 'index.html');
  if (!existsSync(homePath)) return null;
  const html = readFileSync(homePath, 'utf8');
  return matchOne(html, /<link rel="canonical" href="([^" ]+)/);
})();

if (!originFromHome) failures.push('index.html: missing canonical URL');

const origin = originFromHome ? new URL(originFromHome).origin : 'https://www.atoaxis.com';

for (const { locale, route } of EXPECTATIONS) {
  const page = htmlPath(route, locale);

  if (!existsSync(page)) {
    failures.push(`${locale}${route}: not prerendered (${page})`);
    continue;
  }

  const html = readFileSync(page, 'utf8');
  const label = `${locale}${route}`;
  const expectedCanonical = absolutePath(origin, route, locale);
  const actualCanonical = matchOne(html, /<link rel="canonical" href="([^" ]+)/);
  const documentLang = matchOne(html, /<html[^>]*\slang="([^"]+)/);
  const title = matchOne(html, /<title>([^<]+)<\/title>/);
  const h1Count = (html.match(/<h1(?:\s[^>]*)?>/g) ?? []).length;
  const jsonLdCount = (html.match(/<script type="application\/ld\+json">/g) ?? []).length;

  if (documentLang !== locale) failures.push(`${label}: expected html lang=${locale}`);
  if (!title?.includes('AtoAxis')) failures.push(`${label}: title does not name AtoAxis`);
  if (h1Count !== 1) failures.push(`${label}: expected one H1, found ${h1Count}`);
  if (jsonLdCount === 0) failures.push(`${label}: missing JSON-LD`);
  if (actualCanonical !== expectedCanonical) {
    failures.push(`${label}: canonical ${actualCanonical ?? '(missing)'} != ${expectedCanonical}`);
  }

  const alternates = new Map(
    [...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^" ]+)/g)].map((match) => [
      match[1],
      match[2],
    ])
  );
  const expectedEnglish = absolutePath(origin, route, 'en');
  const expectedThai = absolutePath(origin, route, 'th');
  if (alternates.get('en') !== expectedEnglish) {
    failures.push(`${label}: en hreflang is ${alternates.get('en') ?? '(missing)'}`);
  }
  if (alternates.get('th') !== expectedThai) {
    failures.push(`${label}: th hreflang is ${alternates.get('th') ?? '(missing)'}`);
  }
  if (alternates.get('x-default') !== expectedEnglish) {
    failures.push(`${label}: x-default hreflang is ${alternates.get('x-default') ?? '(missing)'}`);
  }

  if (html.includes('github.com/Jitwisut/wakaclock')) {
    failures.push(`${label}: contains private repository URL`);
  }
}

const homepage = readFileSync(join(APP_DIR, 'index.html'), 'utf8');
const thaiHomepage = readFileSync(join(APP_DIR, 'th.html'), 'utf8');
if (!/href="\/early-access">Join early access</.test(homepage)) {
  failures.push('en/: missing hero primary CTA');
}
if (!/href="\/wakatime-alternative">Compare with/.test(homepage)) {
  failures.push('en/: missing hero secondary CTA');
}
if (!/href="\/th\/early-access">เข้าร่วม Early Access</.test(thaiHomepage)) {
  failures.push('th/: missing hero primary CTA');
}
if (!/href="#early-access">/.test(readFileSync(join(APP_DIR, 'join.html'), 'utf8'))) {
  failures.push('en/join: missing campaign primary CTA');
}
if (!/name="early-access"/.test(readFileSync(join(APP_DIR, 'join.html'), 'utf8'))) {
  failures.push('en/join: missing signup form');
}

if (failures.length > 0) {
  console.error('Prerender check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Prerender check passed (${EXPECTATIONS.length} public pages).`);
