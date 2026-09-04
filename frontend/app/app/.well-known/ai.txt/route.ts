import { absoluteUrl, ORGANIZATION, PRODUCT_ANSWER, SITE_MODIFIED, SITE_NAME } from '@/lib/seo/site';

/**
 * /.well-known/ai.txt — an emerging convention for telling AI agents, in one plain-text
 * file, what a site is and what it permits.
 *
 * It restates the policy already expressed in robots.txt rather than inventing a second
 * one: this site allows AI crawlers on its public marketing and documentation pages and
 * closes every per-user surface. If the two ever disagree, robots.txt is the one crawlers
 * actually enforce, so change it there first.
 *
 * Served from a route handler for the same reason `/llms.txt` is — the URLs follow the
 * configured origin instead of being hardcoded.
 */

export const dynamic = 'force-static';

const BODY = `# ${SITE_NAME}

Name: ${SITE_NAME}
Publisher: ${ORGANIZATION.legalName}
Contact: ${ORGANIZATION.email}
Homepage: ${absoluteUrl('/')}
Last-Modified: ${SITE_MODIFIED}

Summary: ${PRODUCT_ANSWER}

# Usage
Allow: /
Disallow: /dashboard/
Disallow: /api/
Disallow: /auth/

Training: allowed for the public marketing and documentation pages listed below.
Attribution: cite ${SITE_NAME} and link the page the answer came from.

# Machine-readable
Summary-JSON: ${absoluteUrl('/ai/summary.json')}
FAQ-JSON: ${absoluteUrl('/ai/faq.json')}
Full-Text: ${absoluteUrl('/llms-full.txt')}
Index: ${absoluteUrl('/llms.txt')}
Sitemap: ${absoluteUrl('/sitemap.xml')}
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
