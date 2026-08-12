import { absoluteUrl, PRIVATE_ROUTE_PREFIXES } from '@/lib/seo/site';

import type { MetadataRoute } from 'next';

/**
 * Search-discovery policy only. This intentionally says nothing about AI training
 * crawlers: allowing a page to be found and answered from is a separate decision
 * from allowing it to be trained on, and no training policy has been set for this
 * product. Adding blanket AI user-agent rules here would silently make that call.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = PRIVATE_ROUTE_PREFIXES.map((prefix) => `${prefix}/`);

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
