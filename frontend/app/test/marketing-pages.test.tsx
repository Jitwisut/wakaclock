import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import {
  LocalizedMarketingPage,
  marketingPageMetadata,
} from '@/components/marketing/localized-page';
import { MARKETING_PAGE_KEYS, PAGE_COPY } from '@/components/marketing/marketing-copy';
import { GET } from '@/app/llms-full.txt/route';
import sitemap from '@/app/sitemap';
import { absoluteUrl, localizedPath } from '@/lib/seo/site';

afterEach(cleanup);

for (const locale of ['en', 'th'] as const) {
  for (const path of MARKETING_PAGE_KEYS) {
    it(`${locale}${path}: exposes one title, working chapter links and matching page identity`, () => {
      const copy = PAGE_COPY[path][locale];
      const metadata = marketingPageMetadata(path, locale);
      expect(metadata.description).toBe(copy.description);
      expect(metadata.alternates?.canonical).toBe(localizedPath(locale, path));
      expect(metadata.title).toEqual(
        copy.metadataTitle.includes('AtoAxis')
          ? { absolute: copy.metadataTitle }
          : copy.metadataTitle
      );
      const { container } = render(<LocalizedMarketingPage locale={locale} path={path} />);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.title);
      const index = screen.getByRole('navigation', {
        name: locale === 'th' ? 'สารบัญ' : 'Table of contents',
      });
      for (const link of index.querySelectorAll('a')) {
        const id = link.getAttribute('href')?.slice(1);
        expect(container.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
      }
      const graph = JSON.parse(
        container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}'
      ) as {
        '@graph': {
          '@type': string;
          url: string;
          description: string;
          hasPart: { url: string }[];
        }[];
      };
      const page = graph['@graph'].find((node: Record<string, unknown>) =>
        ['WebPage', 'AboutPage', 'ContactPage'].includes(String(node['@type']))
      );
      expect(page).toBeDefined();
      if (!page) throw new Error('Missing page schema');
      expect(page.url).toBe(absoluteUrl(localizedPath(locale, path)));
      expect(page.description).toBe(copy.lead);
      for (const part of page.hasPart) {
        expect(
          container.querySelectorAll(`[id="${new URL(part.url).hash.slice(1)}"]`)
        ).toHaveLength(1);
      }
    });
  }
}

it('exports visible Thai answers and their canonical URL in the AI text resource', async () => {
  const text = await GET().text();
  expect(text).toContain(PAGE_COPY['/pricing'].th.lead);
  expect(text).toContain(absoluteUrl('/th/pricing'));
  expect(text).toContain(PAGE_COPY['/docs'].en.lead);
});

it.each(['en', 'th'] as const)(
  'keeps %s pricing chapter copy identical in the page and text export',
  async (locale) => {
    const chapter = PAGE_COPY['/pricing'][locale].sections[1];
    render(<LocalizedMarketingPage locale={locale} path="/pricing" />);
    const text = await GET().text();
    for (const block of chapter.blocks) {
      if (block.kind === 'paragraph') {
        expect(screen.getByText(block.text)).toBeVisible();
        expect(text).toContain(block.text);
      }
    }
  }
);

it('pairs every sitemap entry with published English and Thai counterparts', () => {
  const entries = sitemap();
  const urls = new Set(entries.map((entry) => entry.url));
  for (const entry of entries) {
    expect(urls.has(String(entry.alternates?.languages?.en))).toBe(true);
    expect(urls.has(String(entry.alternates?.languages?.th))).toBe(true);
  }
});
