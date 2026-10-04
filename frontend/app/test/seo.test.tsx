import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { JsonLd } from '@/components/seo/json-ld';
import { PAGE_COPY } from '@/components/marketing/marketing-copy';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import {
  breadcrumbSchema,
  faqSchema,
  graph,
  howToSchema,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from '@/lib/seo/schema';
import {
  absoluteUrl,
  createMarketingMetadata,
  PRIVATE_ROUTE_PREFIXES,
  PUBLIC_ROUTE_DEFINITIONS,
  PUBLIC_ROUTES,
  SITE_NAME,
} from '@/lib/seo/site';

/** Reads the JSON-LD payload back out of a rendered <JsonLd /> block. */
function parseRenderedJsonLd(data: unknown): unknown {
  const { container } = render(<JsonLd data={data} />);
  const script = container.querySelector('script[type="application/ld+json"]');

  expect(script).not.toBeNull();

  return JSON.parse(script?.innerHTML ?? '');
}

describe('JsonLd', () => {
  it('escapes characters that could terminate the surrounding script element', () => {
    const { container } = render(
      <JsonLd data={{ name: '</script><img src=x onerror=alert(1)>' }} />
    );
    const html = container.querySelector('script')?.innerHTML ?? '';

    expect(html).not.toContain('</script>');
    expect(html).not.toContain('<');
  });

  it('escaping preserves the original value after parsing', () => {
    const payload = { name: '</script>' };

    expect(parseRenderedJsonLd(payload)).toEqual(payload);
  });

  it('emits valid JSON for the full site graph', () => {
    const parsed = parseRenderedJsonLd(
      graph(organizationSchema(), websiteSchema(), softwareApplicationSchema())
    ) as { '@context': string; '@graph': unknown[] };

    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@graph']).toHaveLength(3);
  });
});

describe('structured data', () => {
  it('describes the SoftwareApplication with a real name and category', () => {
    const schema = softwareApplicationSchema();

    expect(schema.name).toBe(SITE_NAME);
    expect(schema.applicationCategory).toBe('DeveloperApplication');
    expect(schema.sameAs).toBeUndefined();
    expect(schema.codeRepository).toBeUndefined();
  });

  it('never fabricates ratings, reviews or download counts', () => {
    const serialized = JSON.stringify(
      graph(organizationSchema(), websiteSchema(), softwareApplicationSchema())
    );

    for (const forbidden of [
      'aggregateRating',
      'AggregateRating',
      'ratingValue',
      'reviewCount',
      'Review',
      'downloadCount',
      'interactionCount',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('does not publish a private repository as public evidence', () => {
    const serialized = JSON.stringify(
      graph(organizationSchema(), websiteSchema(), softwareApplicationSchema())
    );

    expect(serialized).not.toContain('github.com/Jitwisut/wakaclock');
  });

  it('contains no undefined values', () => {
    const serialized = JSON.stringify(
      graph(
        organizationSchema(),
        websiteSchema(),
        softwareApplicationSchema(),
        faqSchema([{ question: 'Q', answer: 'A' }]),
        breadcrumbSchema([{ name: 'Home', path: '/' }])
      )
    );

    expect(serialized).not.toContain('undefined');
  });

  it('numbers HowTo steps in the order the page presents them', () => {
    const schema = howToSchema({
      name: 'Getting started',
      description: 'Create an API key, connect an editor and verify tracking.',
      steps: [
        { name: 'Requirements', text: 'What has to be in place first.' },
        { name: 'Create an API key', text: 'Generate a key from the dashboard.' },
      ],
    }) as {
      description: string;
      name: string;
      step: { name: string; position: number; text: string }[];
    };

    expect(schema.name).toBe('Getting started');
    expect(schema.step.map((step) => step.position)).toEqual([1, 2]);
    expect(schema.step[1].name).toBe('Create an API key');
    expect(schema.step[0].text).toBe('What has to be in place first.');
  });

  /**
   * The point of deriving steps from the rendered sections: instructions that exist only
   * in the markup are instructions nobody maintains.
   */
  it('describes the getting-started page with steps taken from its visible sections', () => {
    const copy = PAGE_COPY['/docs/getting-started'].en;
    const schema = howToSchema({
      name: copy.howTo?.name ?? '',
      description: copy.howTo?.description ?? '',
      steps: copy.sections.map((section) => ({
        name: section.heading,
        text: 'placeholder',
      })),
    }) as { step: { name: string }[] };

    expect(copy.howTo).toBeDefined();
    expect(schema.step.map((step) => step.name)).toEqual(
      copy.sections.map((section) => section.heading)
    );
  });

  it('builds FAQPage entries from the supplied questions', () => {
    const entries = [
      { question: `What is ${SITE_NAME}?`, answer: 'A developer time tracker.' },
      { question: 'Is it free?', answer: 'No.' },
    ];
    const schema = faqSchema(entries) as { mainEntity: { name: string }[] };

    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0].name).toBe(`What is ${SITE_NAME}?`);
  });

  /**
   * A trail where two positions resolve to the same page is not a valid trail, and it
   * also produces duplicate React keys in the visible <Breadcrumbs /> list.
   */
  it('resolves every breadcrumb in a trail to a distinct URL', () => {
    const trails = [
      [
        { name: 'Home', path: '/' },
        { name: 'Integrations', path: '/integrations' },
        { name: 'VS Code', path: '/integrations/vscode' },
      ],
      [
        { name: 'Home', path: '/' },
        { name: 'Docs', path: '/docs' },
        { name: 'Getting started', path: '/docs/getting-started' },
      ],
    ];

    for (const trail of trails) {
      const schema = breadcrumbSchema(trail) as { itemListElement: { item: string }[] };
      const urls = schema.itemListElement.map((entry) => entry.item);

      expect(new Set(urls).size).toBe(urls.length);
    }
  });

  it('numbers breadcrumb positions from one and resolves absolute items', () => {
    const schema = breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Pricing', path: '/pricing' },
    ]) as { itemListElement: { item: string; position: number }[] };

    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[1].position).toBe(2);
    expect(schema.itemListElement[1].item).toBe(absoluteUrl('/pricing'));
  });
});

/**
 * The canonical origin is resolved once at module load, so each case here reloads the
 * module with a different environment. This is the guard that stops a production build
 * from silently publishing canonicals and JSON-LD pointing at localhost.
 */
describe('site URL resolution', () => {
  const originalUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalUrl;
    vi.stubEnv('NODE_ENV', originalNodeEnv ?? 'test');
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('uses the configured public origin and emits no localhost URLs', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_URL = 'https://atoaxis.example.com';

    const schema = await import('@/lib/seo/schema');
    const serialized = JSON.stringify(
      schema.graph(schema.organizationSchema(), schema.softwareApplicationSchema())
    );

    expect(serialized).toContain('https://atoaxis.example.com');
    expect(serialized).not.toContain('localhost');
  });

  it('strips a trailing slash so canonicals are not doubled', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_URL = 'https://atoaxis.example.com/';

    const { absoluteUrl: scopedAbsoluteUrl } = await import('@/lib/seo/site');

    expect(scopedAbsoluteUrl('/pricing')).toBe('https://atoaxis.example.com/pricing');
  });

  it('uses the Vercel preview host when no preferred public origin is supplied', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('URL', '');
    vi.stubEnv('DEPLOY_PRIME_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    vi.stubEnv('VERCEL_URL', 'preview.atoaxis.example.com');
    const { SITE_URL: siteUrl, absoluteUrl: previewUrl } = await import('@/lib/seo/site');
    expect(siteUrl).toBe('https://preview.atoaxis.example.com');
    expect(previewUrl('/docs')).toBe('https://preview.atoaxis.example.com/docs');
    vi.unstubAllEnvs();
  });

  it('throws on a production build when no public origin is configured', async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.stubEnv('NODE_ENV', 'production');
    // The throw only guards the server: it must not fire in a client bundle that pulled
    // this module in for its other exports (see the comment in resolveSiteUrl). jsdom
    // provides `window` unconditionally, so it's unstubbed here to simulate the real
    // server context this check is meant for.
    vi.stubGlobal('window', undefined);

    await expect(import('@/lib/seo/site')).rejects.toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it('throws on a production build when the origin is still localhost', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('window', undefined);

    await expect(import('@/lib/seo/site')).rejects.toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it('does not throw in a browser context even with no public origin configured', async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.stubEnv('NODE_ENV', 'production');

    // No window stub here: jsdom's ambient `window` stands in for a real client bundle.
    // Client components (the nav, the language switcher) import this module for its
    // other exports, so this must resolve rather than take down the whole app.
    const { SITE_URL: siteUrl } = await import('@/lib/seo/site');
    expect(siteUrl).toBe('http://localhost:3000');
  });
});

describe('sitemap', () => {
  it('lists every public route as an absolute URL', () => {
    const entries = sitemap();

    expect(entries).toHaveLength(PUBLIC_ROUTE_DEFINITIONS.length);
    expect(PUBLIC_ROUTES).toHaveLength(PUBLIC_ROUTE_DEFINITIONS.length);
    for (const entry of entries) {
      expect(entry.url.startsWith('http')).toBe(true);
    }
  });

  it('excludes dashboard, auth and API routes', () => {
    for (const entry of sitemap()) {
      const { pathname } = new URL(entry.url);

      for (const prefix of PRIVATE_ROUTE_PREFIXES) {
        expect(pathname.startsWith(prefix)).toBe(false);
      }
    }
  });

  it('lists canonical URLs without synthetic freshness or legacy priority fields', () => {
    const entries = sitemap();

    for (const entry of entries) {
      expect(entry.priority).toBeUndefined();
      expect(entry.changeFrequency).toBeUndefined();
      // A real editorial date is allowed; a generated timestamp is not. A literal
      // YYYY-MM-DD is what a hand-maintained content date looks like.
      if (entry.lastModified !== undefined) {
        expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }

    // The distinction that matters: a synthetic value would land on every route,
    // because it comes from the clock rather than from an edit.
    expect(entries.some((entry) => entry.lastModified === undefined)).toBe(true);
    expect(entries.map((entry) => new URL(entry.url).pathname)).toContain('/th');
  });
});

describe('marketing metadata', () => {
  it('merges canonical, language, Open Graph and Twitter fields', () => {
    const metadata = createMarketingMetadata({
      description: 'A concise description for a public marketing page.',
      path: '/pricing',
      title: 'Planned Pricing',
    });

    expect(metadata.alternates?.canonical).toBe('/pricing');
    expect(metadata.alternates?.languages).toMatchObject({
      en: '/pricing',
      th: '/th/pricing',
      'x-default': '/pricing',
    });
    expect(metadata.alternates?.types).toMatchObject({
      'application/rss+xml': '/feed.xml',
    });
    expect(metadata.openGraph).toMatchObject({
      siteName: SITE_NAME,
      type: 'website',
      url: '/pricing',
    });
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ height: 630, url: '/opengraph-image', width: 1200 }),
    ]);
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('does not append the site name twice when a page title already contains it', () => {
    const metadata = createMarketingMetadata({
      description: 'Documentation for the product.',
      path: '/docs',
      title: 'AtoAxis developer time tracking documentation',
    });

    expect(metadata.title).toEqual({
      absolute: 'AtoAxis developer time tracking documentation',
    });
    expect(metadata.openGraph).toMatchObject({
      title: 'AtoAxis developer time tracking documentation',
    });
  });
});

describe('robots', () => {
  it('disallows every private route prefix', () => {
    const [rule] = [robots().rules].flat();
    const disallow = [rule.disallow].flat();

    for (const prefix of PRIVATE_ROUTE_PREFIXES) {
      expect(disallow).toContain(`${prefix}/`);
    }
  });

  it('allows public marketing and docs routes to be crawled', () => {
    const [rule] = [robots().rules].flat();
    const disallow = [rule.disallow].flat().filter(Boolean) as string[];

    for (const route of [
      '/docs/getting-started',
      '/wakatime-alternative',
      '/integrations/vscode',
    ]) {
      expect(disallow.some((entry) => route.startsWith(entry))).toBe(false);
    }
  });

  it('points at the sitemap', () => {
    expect(robots().sitemap).toBe(absoluteUrl('/sitemap.xml'));
  });
});
