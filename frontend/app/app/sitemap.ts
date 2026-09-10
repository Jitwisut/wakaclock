import { absoluteUrl, localizedPath, PUBLIC_ROUTE_DEFINITIONS } from '@/lib/seo/site';

import type { MetadataRoute } from 'next';

/**
 * Only marketing and documentation routes are listed. Dashboard, auth and API
 * routes are deliberately absent — they are private per-user surfaces and are
 * additionally blocked in robots.ts and marked `noindex` in their layouts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Omit lastModified until each page has a real content timestamp. A generated
  // "now" value on every request falsely signals that every page changed.
  return PUBLIC_ROUTE_DEFINITIONS.map((route) => ({
    ...(route.lastModified ? { lastModified: route.lastModified } : {}),
    url: absoluteUrl(route.path),
    alternates: {
      languages: {
        en: absoluteUrl(
          route.locale === 'th' ? route.path.replace(/^\/th(?=\/|$)/, '') || '/' : route.path
        ),
        th: absoluteUrl(route.locale === 'th' ? route.path : localizedPath('th', route.path)),
      },
    },
  }));
}
