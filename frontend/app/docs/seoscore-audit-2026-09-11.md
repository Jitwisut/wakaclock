# AEO/GEO audit response — September 11, 2026

Input: seoscore-site-report-www.atoaxis.com-2026-09-11.csv, five English URLs.

## Implemented

- Visible server-rendered answer guides for all five audited pages: direct answers, key takeaways, definition lists, semantic comparisons, question headings, illustrative examples, recommendations, linked sources and an editorial review date.
- Natural topic terms: developer time tracking, coding metrics, AI attribution, attribution coverage, remote teams, editor heartbeats and migration. No hidden keywords or meta-keyword stuffing.
- Improved English title/H1 alignment for the alternative, analytics and teams pages; shortened the teams description.
- Source context distinguishes API documentation, our product implementation and DORA delivery metrics. Examples are explicitly not customer research.
- New guide anchors join existing page navigation on the four product pages.
- Page-level author and known modification dates in JSON-LD; sitemap dates preserve untouched Thai content dates.
- Eager brand image and preloaded introductory product artwork. Below-fold artwork remains lazy.

## Findings that should not be forced to pass

- Event schema: AI activity events are not scheduled public events.
- Reviews, certifications, expert quotes, customer case studies and original statistics require real evidence. None was invented.
- Video is optional; no video exists to mark up. Code snippets are useful for setup, not mandatory for every analytics page.
- sameAs is identity, not a place to list unrelated Wikipedia or LinkedIn pages. The existing SoftwareApplication already identifies its actual source repository. No unverified company profile was added.
- Framework bootstrap/RSC scripts and JSON-LD must not receive blanket defer/async changes. Local built HTML identifies the non-deferred external script as Next.js polyfills with noModule; modern module-capable browsers skip it. The CSV does not identify its script, so confirm the deployed asset before equating this heuristic with a real blocking resource.
- Text/HTML ratios, exact paragraph lengths and pronoun density are tool heuristics, not reasons to pad copy. Existing useful information is preserved.
- IndexNow key route and postbuild submission script already exist; production needs INDEXNOW_KEY configured. Submission was not performed as part of editing content.

## Remaining verification

Run a fresh seoscore crawl after deployment. Local checks cannot establish new scores, indexing, ranking or AI citations. No production deployment or search-engine submission is included in this change.

Validation: targeted ESLint and TypeScript passed; 64 tests passed across answer-guide, SEO, discovery and marketing-page suites. Production webpack build and prerender checks passed.

Primary references: https://wakatime.com/developers, https://dora.dev/guides/dora-metrics/, https://developers.google.com/search/docs/fundamentals/ai-optimization-guide.
