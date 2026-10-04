import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { LocalizedMarketingPage } from '@/components/marketing/localized-page';
import { PAGE_COPY } from '@/components/marketing/marketing-copy';

const original = PAGE_COPY['/docs'];
afterEach(() => {
  cleanup();
  PAGE_COPY['/docs'] = original;
  vi.doUnmock('@/components/marketing/marketing-copy');
  vi.resetModules();
});

it('renders optional blocks consistently in the page and text export without inventing FAQ content', async () => {
  PAGE_COPY['/docs'] = {
    ...original,
    en: {
      ...original.en,
      breadcrumbs: [],
      faq: undefined,
      related: [{ links: [] }],
      howTo: { name: 'Setup', description: 'Install and configure' },
      sections: [
        {
          id: 'install',
          heading: 'Install',
          blocks: [{ kind: 'bullets', items: ['Install the CLI', 'Configure the destination'] }],
        },
        {
          id: 'command',
          heading: 'Command',
          blocks: [{ kind: 'code', value: 'wakaclock doctor' }],
        },
        { id: 'support', heading: 'Support', blocks: [{ kind: 'email', before: 'Contact ' }] },
      ],
    },
  };
  const { container } = render(<LocalizedMarketingPage locale="en" path="/docs" />);
  expect(screen.getByText('wakaclock doctor')).toBeVisible();
  expect(screen.getByRole('link', { name: 'hello@atoaxis.com' })).toHaveAttribute(
    'href',
    'mailto:hello@atoaxis.com'
  );
  expect(screen.queryByRole('heading', { name: original.en.faq!.heading })).toBeNull();
  const schemas = JSON.parse(
    container.querySelector('script[type="application/ld+json"]')!.textContent!
  ) as { '@graph': { '@type': string; step?: { text: string }[] }[] };
  expect(schemas['@graph'].some((entry) => entry['@type'] === 'FAQPage')).toBe(false);
  expect(schemas['@graph'].find((entry) => entry['@type'] === 'HowTo')?.step).toEqual([
    expect.objectContaining({ text: 'Install the CLI. Configure the destination' }),
  ]);
  // The static route generates its snapshot on import, as it does during a build.
  vi.doMock('@/components/marketing/marketing-copy', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/components/marketing/marketing-copy')>()),
    PAGE_COPY,
  }));
  vi.resetModules();
  const { GET } = await import('@/app/llms-full.txt/route');
  const text = await GET().text();
  expect(text).toContain('```\nwakaclock doctor\n```');
  expect(text).toContain('Contact hello@atoaxis.com');
  expect(text).not.toContain('undefined');
});

it('omits HowTo markup when no instruction can be extracted from the visible sections', () => {
  PAGE_COPY['/docs'] = {
    ...original,
    en: {
      ...original.en,
      howTo: { name: 'Setup', description: 'Install and configure' },
      sections: [
        {
          id: 'command',
          heading: 'Command',
          blocks: [{ kind: 'code', value: 'wakaclock doctor' }],
        },
      ],
    },
  };
  const { container } = render(<LocalizedMarketingPage locale="en" path="/docs" />);
  const schemas = JSON.parse(
    container.querySelector('script[type="application/ld+json"]')!.textContent!
  ) as { '@graph': { '@type': string }[] };
  expect(schemas['@graph'].some((entry) => entry['@type'] === 'HowTo')).toBe(false);
  expect(screen.getByText('wakaclock doctor')).toBeVisible();
});
