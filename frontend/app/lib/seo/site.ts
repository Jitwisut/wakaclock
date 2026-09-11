import type { Metadata } from 'next';

/**
 * Single source of truth for public site identity, canonical URLs, localized routes,
 * metadata and structured data.
 *
 * Every claim expressed here is verified against the product source:
 *   - heartbeat ingest + fields .... backend/api/src/handlers/v1/heartbeats.rs
 *   - analytics endpoints .......... backend/api/src/handlers/v1/mod.rs
 *   - AI attribution fields ........ backend/api/src/model/ai_stats.rs
 *   - keystroke metrics ............ backend/api/src/model/keystroke_stats.rs
 *   - AST language detection ....... backend/api/crates/wakaclock-ast
 *   - VS Code client ............... extensions/vscode
 *
 * Do not add capability copy here that is not backed by one of those paths.
 */

/**
 * Brand name. The product is marketed as "AtoAxis"; the underlying binary, config
 * path and editor setting keys still ship as `wakaclock-*` and are referenced
 * verbatim in installation docs so the documented commands actually run.
 */
export const SITE_NAME = 'AtoAxis';
export const SITE_TAGLINE = 'One timeline for everything you do.';
export const SITE_LOCALES = ['en', 'th'] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];
export const DEFAULT_LOCALE: SiteLocale = 'en';

/**
 * Canonical origin. Production builds must supply a real public URL — a canonical
 * pointing at localhost silently poisons every indexed page, so we fail loudly
 * instead of falling back.
 */
function resolveSiteUrl(): string {
  // NEXT_PUBLIC_APP_URL is the preferred value because it can point at a
  // custom production domain on any host. Netlify exposes URL/DEPLOY_PRIME_URL and
  // Vercel exposes VERCEL_PROJECT_PRODUCTION_URL/VERCEL_URL during a build, so
  // previews and first deploys on either provider still get a valid canonical
  // origin when the project variable has not been configured yet. Vercel's
  // variables carry a bare host with no protocol, so one is added below.
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();

  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.URL?.trim() ||
    process.env.DEPLOY_PRIME_URL?.trim() ||
    (vercelHost ? `https://${vercelHost}` : undefined);

  if (configured && !configured.includes('localhost')) {
    return configured.replace(/\/$/, '');
  }

  // Client components (the nav, the language switcher, the early-access form) import
  // this module for its other exports — SITE_NAME, localizedPath, the SiteLocale type —
  // which pulls this whole function, and this throw, into the browser bundle too. SITE_URL
  // itself is only ever read server-side (root layout metadata, manifest.ts, the JSON-LD
  // in lib/seo/schema.ts), so the guard below scopes the fail-loud check to a real Node
  // build/runtime. Without it, any preview deploy that hasn't set NEXT_PUBLIC_APP_URL yet
  // throws during module evaluation in the browser and takes down every page with a
  // client-side exception, instead of just missing a canonical tag server-side.
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_APP_URL (or a hosting-provided public URL) must be set for production builds. ' +
        'Canonical URLs and structured data cannot be generated from a localhost origin.'
    );
  }

  return (configured ?? 'http://localhost:3000').replace(/\/$/, '');
}

export const SITE_URL = resolveSiteUrl();

export const SOCIAL_IMAGE_PATH = '/opengraph-image';
export const SOURCE_REPOSITORY_URL = 'https://github.com/Jitwisut/wakaclock';

export function localizedPath(locale: SiteLocale, path: string): string {
  let normalized = path;

  if (path === '/') {
    normalized = '';
  } else if (!path.startsWith('/')) {
    normalized = `/${path}`;
  }

  if (locale === DEFAULT_LOCALE) {
    return normalized || '/';
  }

  return normalized ? `/th${normalized}` : '/th';
}

export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

/** Who builds the product — AtoAxis is developed by a team of fourth-year students. */
export const ORGANIZATION = {
  email: 'hello@atoaxis.com',
  // No separate registered entity exists yet (student project) — the product name
  // doubles as the legal/publisher name in structured data until that changes.
  legalName: SITE_NAME,
  logo: absoluteUrl('/atoaxis-symbol-v2.png'),
  name: SITE_NAME,
  url: SITE_URL,
} as const;

/** Commercial terms planned for launch; checkout is not enabled in Early Access. */
export const PRICING = {
  monthlyUsd: 12,
  annualUsd: 99,
  currency: 'USD',
  status: 'planned',
} as const;

/**
 * The 40-80 word definitional answer. Reused verbatim by the homepage's
 * "What is AtoAxis?" section and by the site-level meta description so search
 * engines and answer engines extract one consistent definition.
 *
 * Note for future edits: this product is a hosted service. Earlier drafts described it
 * as customer-operated infrastructure — that was wrong and every page was corrected. Do not
 * reintroduce customer-operated infrastructure language, and do not claim the customer owns or
 * can query the database.
 */
export const PRODUCT_ANSWER =
  `${SITE_NAME} is a developer time tracking service. It receives coding activity from ` +
  'your editor as heartbeats and turns them into dashboards for coding time, projects, ' +
  'programming languages, branches and editors. It implements the WakaTime API, so an ' +
  'editor that already has a WakaTime plugin can send data to it, and every account ' +
  'includes your complete coding history rather than a limited recent window.';

/**
 * Capabilities that are designed but NOT built. Anything listed here must be described
 * in the future tense and visibly labelled as upcoming wherever it appears — never in
 * `PRODUCT_ANSWER`, never in SoftwareApplication structured data, and never answered
 * "yes" in an FAQ. The whole site was audited once to remove claims the code could not
 * back; this constant exists so the next person does not have to do it again.
 *
 * The team/presence work in the repository is prototype-level only. It must not be
 * described as a production capability until persistence, permissions, analytics and
 * billing are complete.
 */
export const IN_DEVELOPMENT = {
  teamPresence: 'Team presence with animated avatars (Early Access)',
  subTeams: 'Sub-teams within an organisation (Early Access)',
  coworkingSessions: 'Drag-to-join co-working sessions (Early Access)',
} as const;

export const EN_PUBLIC_ROUTES = [
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
  '/about',
  '/contact',
  '/terms',
  '/early-access',
  '/join',
] as const;

export const TH_PUBLIC_ROUTES = EN_PUBLIC_ROUTES.map((route) => localizedPath('th', route));

export interface PublicRouteDefinition {
  lastModified?: string;
  locale: SiteLocale;
  path: string;
}

/**
 * Dates a page's content actually changed, in ISO form.
 *
 * Only pages with a known editorial date appear here. A crawler treats `lastmod` as a
 * claim it can check, so a generated "now" on every page — or a date copied from a
 * deploy rather than from the copy — teaches it to ignore the field entirely. Add an
 * entry when you change that page's words, not when you touch its component.
 */
const AUDIT_REVIEW_DATE = '2026-09-11';
/** Round 3 of the SEOScore audit response — see docs/seoscore-audit-2026-09-12-round-3.md. */
const AUDIT_REVIEW_DATE_ROUND_3 = '2026-09-12';
const ROUTE_CONTENT_DATES: Readonly<Record<string, string>> = {
  '/': AUDIT_REVIEW_DATE,
  '/teams': AUDIT_REVIEW_DATE,
  '/developer-analytics': AUDIT_REVIEW_DATE,
  '/ai-coding-tracker': AUDIT_REVIEW_DATE,
  '/wakatime-alternative': AUDIT_REVIEW_DATE,
  '/pricing': AUDIT_REVIEW_DATE,
  '/integrations': AUDIT_REVIEW_DATE,
  '/docs': AUDIT_REVIEW_DATE,
  '/ai-cost-tracking': '2026-08-23',
  '/about': AUDIT_REVIEW_DATE_ROUND_3,
  '/contact': AUDIT_REVIEW_DATE_ROUND_3,
  '/terms': AUDIT_REVIEW_DATE_ROUND_3,
  '/privacy': AUDIT_REVIEW_DATE_ROUND_3,
  '/early-access': AUDIT_REVIEW_DATE_ROUND_3,
  '/docs/getting-started': AUDIT_REVIEW_DATE_ROUND_3,
  '/integrations/vscode': AUDIT_REVIEW_DATE_ROUND_3,
  '/join': AUDIT_REVIEW_DATE_ROUND_3,
};
/** Thai-only content dates, for pages whose Thai copy changed independently of English. */
const TH_ROUTE_CONTENT_DATES: Readonly<Record<string, string>> = {
  '/wakatime-alternative': AUDIT_REVIEW_DATE_ROUND_3,
  '/ai-coding-tracker': AUDIT_REVIEW_DATE_ROUND_3,
};

export function contentModified(path: string, locale: SiteLocale): string | undefined {
  // The September 11 audit updated English copy only; round 3 (September 12) added
  // Thai-specific fixes to these two paths without touching their English copy.
  if (locale === 'th') {
    if (path === '/') return AUDIT_REVIEW_DATE;
    if (path === '/ai-cost-tracking') return '2026-08-23';
    return TH_ROUTE_CONTENT_DATES[path];
  }
  return ROUTE_CONTENT_DATES[path];
}

/**
 * The newest date above, used as the site-wide `dateModified` in structured data.
 *
 * Deliberately derived rather than hand-written: a second literal would be a second thing
 * to forget. Answer engines read `dateModified` as the freshness signal for the entity,
 * not for one URL, so the most recent editorial change on the site is the honest value.
 */
export const SITE_MODIFIED = Object.values(ROUTE_CONTENT_DATES).sort().at(-1) as string;

/** Locale-aware route inventory. Add a real content date only when the page changes. */
export const PUBLIC_ROUTE_DEFINITIONS: readonly PublicRouteDefinition[] = [
  ...EN_PUBLIC_ROUTES.map((path) => ({
    locale: 'en' as const,
    path,
    ...(ROUTE_CONTENT_DATES[path] ? { lastModified: ROUTE_CONTENT_DATES[path] } : {}),
  })),
  ...EN_PUBLIC_ROUTES.map((path) => ({
    locale: 'th' as const,
    path: localizedPath('th', path),
    ...(contentModified(path, 'th') ? { lastModified: contentModified(path, 'th') } : {}),
  })),
];

/** Canonical public URL paths, including both language variants. */
export const PUBLIC_ROUTES = [...EN_PUBLIC_ROUTES, ...TH_PUBLIC_ROUTES] as readonly string[];

export function createMarketingMetadata({
  description,
  locale = DEFAULT_LOCALE,
  path,
  title,
}: {
  description: string;
  locale?: SiteLocale;
  path: string;
  title: string;
}): Metadata {
  const canonicalPath = localizedPath(locale, path);
  const englishPath = localizedPath('en', path);
  const thaiPath = localizedPath('th', path);
  const displayTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return {
    // The root layout appends the site name through its title template. Titles that
    // already name AtoAxis must be absolute or Next renders "AtoAxis … | AtoAxis".
    title: title.includes(SITE_NAME) ? { absolute: title } : title,
    description,
    alternates: {
      canonical: canonicalPath,
      languages: {
        en: englishPath,
        th: thaiPath,
        'x-default': englishPath,
      },
      types: {
        'application/rss+xml': '/feed.xml',
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'th' ? 'th_TH' : 'en_US',
      alternateLocale: [locale === 'th' ? 'en_US' : 'th_TH'],
      siteName: SITE_NAME,
      title: displayTitle,
      description,
      url: canonicalPath,
      images: [
        {
          alt: `${SITE_NAME} — ${title}`,
          height: 630,
          url: SOCIAL_IMAGE_PATH,
          width: 1200,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle,
      description,
      images: [SOCIAL_IMAGE_PATH],
    },
  };
}

/** Route prefixes that must never be crawled or listed in the sitemap. */
export const PRIVATE_ROUTE_PREFIXES = ['/dashboard', '/api', '/auth'] as const;
