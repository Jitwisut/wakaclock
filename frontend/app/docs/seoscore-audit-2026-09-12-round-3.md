# SEOScore audit response — round 3

Input: `seoscore-site-report-www.atoaxis.com-2026-09-11-3.csv` (20 URLs,
September 11, 2026). This round focuses on the AEO/GEO gap on: `/login`,
`/early-access`, `/contact`, `/about`, `/terms`, `/th/ai-coding-tracker`,
`/integrations/vscode`, `/privacy`, `/docs/getting-started`,
`/th/wakatime-alternative`, `/join`, `/th` — the pages the user asked to be
prioritized.

## Root causes found

- **The answer-guide component never rendered on 8 pages that had no entry in
  its `GUIDES` map**: `/about`, `/contact`, `/terms`, `/privacy`,
  `/early-access`, `/docs/getting-started`, `/integrations/vscode`. This
  single component supplies most of the checks the report calls out —
  key-value facts (`aeo_key_value`), a cited "Sources and review" section
  (`aeo_citations`, `geo_citations`, `geo_source_diversity`), a comparison
  table (`geo_format_variety`), a dated `<time>` element (`geo_time_element`,
  `geo_freshness`) and a Q&A block (`aeo_qa_blocks`, `geo_paa_format`).
- **`hasAnswerGuide` returned `path === '/'` for every Thai page**, so
  `/th/wakatime-alternative` and `/th/ai-coding-tracker` rendered none of the
  above even though their English counterparts did — the main reason those
  two pages trailed their English versions by 15–20 AEO/GEO points.
- **Three pages' FAQ sections were a generated placeholder**
  (`/integrations/vscode`, `/privacy`, `/docs/getting-started`): six or seven
  entries reading "*Section name*: common question" answered with "See the
  section above for the current product behavior and data limits," repeated
  verbatim. A real FAQ existed in name only.
- `/join` (the campaign landing page) does not use the shared page template
  at all — it is a bespoke component — so it never had a key-facts block or a
  cited sources section.
- `/login`'s Open Graph `url` pointed at the homepage because the page
  defined no `openGraph` of its own and inherited the root layout's whole
  object unchanged.

## Implemented

- Added seven English answer guides — key takeaways, a worked example, a
  comparison table, a recommendation, and cited sources — to `/about`,
  `/contact`, `/terms`, `/privacy`, `/early-access`, `/docs/getting-started`
  and `/integrations/vscode`. Every fact and source in them is drawn from
  this page's own already-published copy or the product source repository;
  nothing new was claimed.
- Generalized `hasAnswerGuide`/`AnswerGuide` (`components/marketing/answer-guide.tsx`)
  to look up guides per locale instead of hardcoding Thai to the homepage
  only, and added real Thai guides for `/th/wakatime-alternative` and
  `/th/ai-coding-tracker`.
- `/th/wakatime-alternative` already carries the highest brand-keyword
  density on the site (14.2% "wakatime", per the report's own
  `geo_keyword_stuffing` check). The new Thai guide and its default sources
  table deliberately avoid repeating "WakaTime" — it names the product once
  and otherwise says "ระบบเดิม" ("your existing system"). A dedicated Thai
  source/table fallback (`THAI_DEFAULT_SOURCES`, `THAI_DEFAULT_TABLE`) keeps
  this discipline available to any future Thai guide, rather than only this
  one page.
- Replaced the generated placeholder FAQ on `/integrations/vscode`,
  `/privacy` and `/docs/getting-started` with real, specific entries (6–7
  each, English and Thai) written against each page's actual settings,
  fields and troubleshooting steps. Added new FAQ sections — previously
  absent — to `/about`, `/contact`, `/terms` and `/early-access`, in the same
  style already used on `/pricing` and `/docs`.
- Added a "Key facts" and "Sources and review" section to the `/join`
  campaign page, matching the answer-guide pattern without disturbing its
  existing hero, value grid, pricing panel or FAQ.
- Fixed `/login`'s Open Graph metadata to point at `/login` with its own
  title, description and image, using `createMarketingMetadata` instead of a
  hand-rolled `openGraph` object — a hand-rolled object would have *replaced*
  the root layout's `openGraph` wholesale rather than only overriding `url`,
  which would have dropped the title, description and image from any shared
  link.
- Removed `genericFaq`'s unused `count`/`headings` code path: every
  `generic()` page now supplies real `faqEntries`, so the "see the section
  above" generator has no remaining caller.
- Added `2026-09-12` content dates for every page touched in this round
  (`lib/seo/site.ts`), including a Thai-only date for the two Thai guides
  added without an English content change.

## Findings intentionally handled differently

- **`/login` stays `noindex`**, per round 2's decision: it is a credential
  transaction, not a search landing page. This round did not add an
  answer guide, FAQ, citations or comparison content to it, and did not
  change that decision. **Its AEO 42 / GEO 32 will not improve on the next
  crawl** — the report's own `geo_robots_ai` check ("Page restricts AI
  access") flags exactly this, correctly. The only changes here are a fixed
  Open Graph URL and nothing else; both `form_labels` and
  `title_desc_duplicate` findings the report lists were already fixed by
  round 2 and were re-checked against the current source, not re-fixed.
- **`aeo_toc` is flagged on every one of the 20 crawled pages**, including
  `/pricing`, `/integrations`, `/docs` and `/th`, which round 2 already
  addressed. Every marketing page already renders a visible, in-flow "On
  this page" navigation (`PageIndex` in `localized-page.tsx`) with anchor
  links to every section, plus the answer guide when present. The crawler's
  TOC heuristic does not recognize this pattern. Declined: duplicating that
  navigation under a literal "Table of Contents" heading would be
  redundant UI for a check that already has a working equivalent.
- **`aeo_video`, `geo_trust` (reviews/certifications), `geo_expert_quotes`,
  `geo_case_study`, `geo_original` ("our research shows…"),
  `geo_knowledge_graph` (Wikipedia/Wikidata/LinkedIn `sameAs`) and
  `geo_statistics_density`** are declined for the same reason round 2 gave:
  they require real evidence — reviews, quotes, third-party entity links,
  measured statistics — that does not exist yet for an Early Access product
  built by a small team. Inventing any of it to raise a score would make the
  page less honest, not more useful.
- **`geo_author_credentials`** stays a named team ("AtoAxis development
  team" / "AtoAxis") rather than an individual byline, since the product is
  built by a team and no individual author signs this content.
- **Thai `/th/pricing`, `/th/integrations`, `/th/docs`, `/th/teams` and
  `/th/developer-analytics` have the same `hasAnswerGuide` gap** that
  `/th/wakatime-alternative` and `/th/ai-coding-tracker` had, since they were
  never in this report and are not in the pages the user asked to prioritize
  in this round. The generalized locale lookup in `answer-guide.tsx` can
  take a Thai guide for any of them the same way; none was written this
  round to keep the change scoped to the requested pages.

## Known, unrelated pre-existing issue

`npm run test:run` has one pre-existing failure unrelated to this round:
`test/marketing-parity.test.ts` expects the English and Thai `/docs` pages to
have the same number of sections, and `/docs` Thai copy currently has one
heading against English's three. This predates this round (verified against
`git show HEAD` before any change here) and `/docs` was not part of this
round's scope, so it was left as found rather than fixed under a different
task.

## Validation

- `npm run typecheck`, `npm run lint:strict` and `npm run test:run` pass
  (333/334 tests; the one failure is the pre-existing, unrelated one above).
- `npm run build` succeeds; all 49 pages generate, including the seven pages
  that gained an answer guide and the two Thai pages that gained one for the
  first time.
- Grepped the prerendered HTML for `/about`, `/contact`, `/terms`,
  `/privacy`, `/early-access`, `/docs/getting-started`,
  `/integrations/vscode`, `/th/wakatime-alternative` and
  `/th/ai-coding-tracker`: each contains the new `<dl>` key facts, an
  `id="answer-guide"` section, a dated `<time datetime="2026-09-12">` and
  FAQPage JSON-LD.
- Started the production server and confirmed `/login`'s `og:url` now reads
  `https://www.atoaxis.com/login` with its own title, description and image
  (previously the homepage's, with no title).
- Scores and rankings can only be measured after deployment and a fresh
  crawl. This change does not promise a ranking position, and `/login`'s
  score is expected to stay low by design.
