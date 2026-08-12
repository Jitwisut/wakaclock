/**
 * Single source of truth for public site identity, canonical URLs, and structured data.
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
 * Brand name. The product is marketed as "Azyren"; the underlying binary, config
 * path and editor setting keys still ship as `wakaclock-*` and are referenced
 * verbatim in installation docs so the documented commands actually run.
 */
export const SITE_NAME = 'Azyren';
export const SITE_TAGLINE = 'One timeline for everything you do.';

/**
 * Canonical origin. Production builds must supply a real public URL — a canonical
 * pointing at localhost silently poisons every indexed page, so we fail loudly
 * instead of falling back.
 */
function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured && !configured.includes('localhost')) {
    return configured.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_APP_URL must be set to the public site origin for production builds. ' +
        'Canonical URLs and structured data cannot be generated from a localhost origin.'
    );
  }

  return (configured ?? 'http://localhost:3000').replace(/\/$/, '');
}

export const SITE_URL = resolveSiteUrl();

export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

/** The legal entity behind the product, taken from the repository LICENSE. */
export const ORGANIZATION = {
  name: 'StandUpCode / Lodash (Thailand) Co., Ltd.',
  url: SITE_URL,
} as const;

/** Commercial terms, confirmed by the product owner. */
export const PRICING = {
  monthlyUsd: 12,
  annualUsd: 99,
  trialDays: 14,
  currency: 'USD',
} as const;

/**
 * The 40-80 word definitional answer. Reused verbatim by the homepage's
 * "What is Azyren?" section and by the site-level meta description so search
 * engines and answer engines extract one consistent definition.
 */
export const PRODUCT_ANSWER =
  `${SITE_NAME} is a self-hosted developer time tracking service. It receives coding ` +
  'activity from your editor as heartbeats and turns them into dashboards for coding ' +
  'time, projects, programming languages, branches and editors. It speaks the WakaTime ' +
  'API, so editors that already have a WakaTime plugin can send data to your own ' +
  'server, and it stores that data in a ClickHouse database you control.';

export const PUBLIC_ROUTES = [
  '/',
  '/wakatime-alternative',
  '/ai-coding-tracker',
  '/developer-analytics',
  '/integrations',
  '/integrations/vscode',
  '/pricing',
  '/privacy',
  '/docs',
  '/docs/getting-started',
] as const;

/** Route prefixes that must never be crawled or listed in the sitemap. */
export const PRIVATE_ROUTE_PREFIXES = ['/dashboard', '/api', '/auth'] as const;
