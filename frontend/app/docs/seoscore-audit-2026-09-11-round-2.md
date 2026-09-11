# SEOScore audit response — round 2

Input: `seoscore-site-report-www.atoaxis.com-2026-09-11-2.csv` (10 URLs,
September 11, 2026).

## Implemented

- Added server-rendered answer guides to `/pricing`, `/integrations` and
  `/docs`, including direct answers, question headings, definition lists,
  comparison tables, examples, recommendations, sources and review dates.
- Added a Thai answer guide to `/th` with Thai definitions, metric
  interpretation, an illustrative example and primary sources. The added copy
  avoids repeating the brand name so it lowers rather than increases the
  reported brand-keyword density.
- Expanded the documentation hub into three useful question-led sections and
  included verification commands.
- Rewrote English titles, H1 text and meta descriptions for pricing,
  integrations and docs around their actual search intent.
- Replaced placeholder pricing questions with six specific answers about
  checkout status, planned monthly and annual pricing, included capabilities,
  free-tier status and Early Access. Added verified FAQ content and FAQPage
  schema to integrations and docs as well.
- Prevented Next.js from appending `| AtoAxis` to titles that already include
  the brand name.
- Added known editorial dates to page JSON-LD and the sitemap for the changed
  pages.
- Updated the verified bundled AI integration count from three to five: Claude
  Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI.
- Let the navigation logo preload while footer instances retain normal lazy
  loading.
- Improved `/login` with a matching title and H1, concise description,
  self-canonical URL, skip link and links to About, Contact, Privacy and Terms.

## Findings intentionally handled differently

- `/login` remains `noindex`. It is a credential transaction, not a search
  landing page, so its AEO/GEO score is not a target. Adding articles, FAQ
  schema, citations, comparison tables or author markup there would damage the
  sign-in flow.
- Live `/th` output already uses the same Thai phrase in title and H1. The
  reported 0% overlap is a tokenizer limitation, not a content mismatch.
- The reported non-deferred external script is the Next.js `noModule` polyfill.
  Modern module-capable browsers skip it. Other framework scripts are
  asynchronous in the deployed HTML.
- Reviews, certifications, case studies, expert quotes and customer statistics
  require real evidence and were not invented.
- `sameAs` only identifies real profiles for the same entity. Unrelated
  Wikipedia, Wikidata or LinkedIn URLs were not added.
- IndexNow support already exists through `/indexnow-key.txt` and the postbuild
  submission script. Production still requires `INDEXNOW_KEY` configuration.

Scores and rankings can only be measured after deployment and a fresh crawl.
This change does not promise a ranking position.

## Validation

- ESLint strict mode and TypeScript type checking pass.
- 93 focused tests pass across SEO, discovery, answer guides, marketing pages,
  authentication and marketing interactions.
- The production build passes for all 49 generated pages.
- Prerendered `/pricing`, `/integrations`, `/docs` and `/th` HTML includes a
  definition list, comparison table, figure caption and review date. All four
  now include FAQPage schema, and the three English pages contain more than 800
  visible words each.
