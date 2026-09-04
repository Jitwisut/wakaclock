import {
  EN_HOME,
  MARKETING_PAGE_KEYS,
  PAGE_COPY,
} from '@/components/marketing/marketing-copy';
import { absoluteUrl, SITE_MODIFIED, SITE_NAME } from '@/lib/seo/site';

export const dynamic = 'force-static';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const FEED_ITEMS = [
  { description: EN_HOME.description, path: '/', title: EN_HOME.title.replace('\n', ' ') },
  ...MARKETING_PAGE_KEYS.map((path) => ({
    description: PAGE_COPY[path].en.description,
    path,
    title: PAGE_COPY[path].en.title,
  })),
];

export function GET(): Response {
  const feedUrl = absoluteUrl('/feed.xml');
  const items = FEED_ITEMS.map(({ description, path, title }) => {
    const url = absoluteUrl(path);

    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(description)}</description>
    </item>`;
  }).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME} product and documentation updates</title>
    <link>${escapeXml(absoluteUrl('/'))}</link>
    <description>Public product, integration and documentation pages from ${SITE_NAME}.</description>
    <language>en</language>
    <lastBuildDate>${new Date(`${SITE_MODIFIED}T00:00:00Z`).toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
