import { absoluteUrl, PRIVATE_ROUTE_PREFIXES } from '@/lib/seo/site';

import type { MetadataRoute } from 'next';

/**
 * Search- and answer-discovery policy.
 *
 * "Found and answered from" and "trained on" are separate decisions. This product
 * makes the deliberate call to permit both for its public marketing and
 * documentation pages: AtoAxis wants answer engines (ChatGPT, Claude, Perplexity,
 * Gemini and their search indexes) to fetch and cite these pages, and the same
 * pages are already public to any search crawler. Every per-user surface
 * (`/dashboard`, `/api`, `/auth`) stays closed to every agent, named or not.
 *
 * The wildcard rule below already permits the named AI crawlers — several of them
 * only honour a rule addressed to their own token, so they are listed explicitly
 * to keep this decision visible in one place rather than implied.
 */
const AI_CRAWLER_USER_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
] as const;

export default function robots(): MetadataRoute.Robots {
  const disallow = PRIVATE_ROUTE_PREFIXES.map((prefix) => `${prefix}/`);

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({ userAgent, allow: '/', disallow })),
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
