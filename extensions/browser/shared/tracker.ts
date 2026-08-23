/** Privacy-first WebExtension core shared by Chromium, Firefox and Safari builds.
 *
 * The default payload contains only a normalized domain. URL paths and tab titles stay
 * local unless the user explicitly enables title tracking. Incognito is disabled by
 * default and private/password domains are denied before a heartbeat is constructed.
 */

export type BrowserEntityType = 'domain' | 'url';

export interface BrowserTrackerOptions {
  allowlist: string[];
  denylist: string[];
  incognito: boolean;
  titleTracking: boolean;
  urlTracking: boolean;
  afkTimeoutMs: number;
}

export interface BrowserHeartbeat {
  category: 'browsing';
  entity: string;
  entity_type: BrowserEntityType;
  is_write: false;
  language: null;
  project: null;
  time: number;
  title?: string;
}

const PRIVATE_DOMAIN_PATTERNS = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /(^|\.)bank/i,
  /(^|\.)health/i,
  /(^|\.)medical/i,
  /(^|\.)password/i,
];

export const DEFAULT_BROWSER_TRACKER_OPTIONS: BrowserTrackerOptions = {
  allowlist: [],
  denylist: [],
  incognito: false,
  titleTracking: false,
  urlTracking: false,
  afkTimeoutMs: 15 * 60 * 1000,
};

export function normalizeOptions(
  options: Partial<BrowserTrackerOptions> = {}
): BrowserTrackerOptions {
  const merged = { ...DEFAULT_BROWSER_TRACKER_OPTIONS, ...options };
  return {
    ...merged,
    afkTimeoutMs: Math.max(60_000, Math.min(24 * 60 * 60 * 1000, merged.afkTimeoutMs)),
  };
}

export function shouldTrack(url: string, options: BrowserTrackerOptions): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_DOMAIN_PATTERNS.some((pattern) => pattern.test(hostname))) return false;
  if (matchesDomain(hostname, options.denylist)) return false;
  return options.allowlist.length === 0 || matchesDomain(hostname, options.allowlist);
}

export function buildHeartbeat(
  url: string,
  title: string | undefined,
  now = Date.now(),
  options: BrowserTrackerOptions = DEFAULT_BROWSER_TRACKER_OPTIONS
): BrowserHeartbeat | null {
  if (!shouldTrack(url, options)) return null;
  const parsed = new URL(url);
  const entity = options.urlTracking ? `${parsed.origin}${parsed.pathname}` : parsed.hostname;
  const heartbeat: BrowserHeartbeat = {
    category: 'browsing',
    entity,
    entity_type: options.urlTracking ? 'url' : 'domain',
    is_write: false,
    language: null,
    project: null,
    time: now / 1000,
  };
  if (options.titleTracking && title?.trim()) heartbeat.title = title.trim().slice(0, 256);
  return heartbeat;
}

export function isIdle(lastActivityAt: number, now = Date.now(), options = DEFAULT_BROWSER_TRACKER_OPTIONS) {
  return now - lastActivityAt >= options.afkTimeoutMs;
}

function matchesDomain(hostname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const normalized = pattern.trim().toLowerCase().replace(/^\*\./, '');
    return normalized !== '' && (hostname === normalized || hostname.endsWith(`.${normalized}`));
  });
}
