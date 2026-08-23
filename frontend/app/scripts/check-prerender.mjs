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

/** Each check names a prerendered page and the substrings its HTML must contain. */
const EXPECTATIONS = [
  {
    page: 'index.html',
    required: [
      { label: 'hero primary CTA', pattern: /href="\/early-access">Join early access</ },
      { label: 'hero secondary CTA', pattern: /href="\/wakatime-alternative">Compare with/ },
      { label: 'FAQ structured data', pattern: /application\/ld\+json/ },
    ],
  },
  {
    page: 'th.html',
    required: [
      { label: 'hero primary CTA', pattern: /href="\/th\/early-access">เข้าร่วม Early Access</ },
      { label: 'FAQ structured data', pattern: /application\/ld\+json/ },
    ],
  },
  {
    page: 'join.html',
    required: [
      { label: 'campaign primary CTA', pattern: /href="#early-access">/ },
      { label: 'signup form', pattern: /name="early-access"/ },
    ],
  },
];

if (!existsSync(APP_DIR)) {
  console.error(`No build found at ${APP_DIR}. Run \`next build\` first.`);
  process.exit(1);
}

const failures = [];

for (const { page, required } of EXPECTATIONS) {
  const path = join(APP_DIR, page);

  if (!existsSync(path)) {
    failures.push(`${page}: not prerendered`);
    continue;
  }

  const html = readFileSync(path, 'utf8');

  for (const { label, pattern } of required) {
    if (!pattern.test(html)) failures.push(`${page}: missing ${label}`);
  }
}

if (failures.length > 0) {
  console.error('Prerender check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Prerender check passed (${EXPECTATIONS.length} pages).`);
