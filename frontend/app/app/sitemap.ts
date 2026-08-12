import { absoluteUrl, PUBLIC_ROUTES } from '@/lib/seo/site';

import type { MetadataRoute } from 'next';

/**
 * Only marketing and documentation routes are listed. Dashboard, auth and API
 * routes are deliberately absent — they are private per-user surfaces and are
 * additionally blocked in robots.ts and marked `noindex` in their layouts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    lastModified,
    changeFrequency: route === '/' ? ('weekly' as const) : ('monthly' as const),
    priority: route === '/' ? 1 : 0.7,
  }));
}
