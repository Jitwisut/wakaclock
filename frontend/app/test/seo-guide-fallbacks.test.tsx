import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { AnswerGuide } from '@/components/marketing/answer-guide';
import { evidenceFor, externalReferences } from '@/components/marketing/answer-guide-more';
import { LocalizedMarketingPage } from '@/components/marketing/localized-page';
import { productTourSchema } from '@/components/marketing/product-tour';
import { founderSchema, webPageSchema } from '@/lib/seo/schema';
import { absoluteUrl, FOUNDER } from '@/lib/seo/site';

// Every marketing page has a guide and a trade-off today; these mocks keep the fallbacks
// honest for a page added later without one.
vi.mock('@/components/marketing/answer-guide', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/marketing/answer-guide')>()),
  hasAnswerGuide: () => false,
}));
vi.mock('@/components/marketing/answer-guide-more', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/marketing/answer-guide-more')>()),
  tradeoffFor: () => undefined,
}));

it('renders a page without a guide and leaves the tour out of its graph', () => {
  const { container } = render(<LocalizedMarketingPage locale="en" path="/pricing" />);
  expect(container.querySelector('a[href="#answer-guide"]')).toBeNull();
  const graph = container.querySelector('script[type="application/ld+json"]')?.textContent ?? '';
  expect(graph).not.toContain('VideoObject');
});

it('omits the trade-off block when a page has none', () => {
  const { container } = render(<AnswerGuide locale="en" path="/" />);
  expect(container.querySelector('#answer-guide')).not.toBeNull();
  expect(container.textContent).not.toContain('Trade-offs to weigh');
});

it('has no external references or survey evidence for an unknown page', () => {
  expect(externalReferences('/not-a-page', 'en')).toEqual([]);
  expect(evidenceFor('/not-a-page', 'th')).toBeUndefined();
  expect(evidenceFor('/ai-coding-tracker', 'th')?.text).toContain('84%');
});

it('describes the founder as the author, inline and with the confirmed profile only', () => {
  expect(founderSchema()).toMatchObject({
    '@type': 'Person',
    name: FOUNDER.name,
    jobTitle: FOUNDER.jobTitle,
    sameAs: [...FOUNDER.sameAs],
    url: absoluteUrl('/about'),
  });
  const page = webPageSchema({ path: '/docs', locale: 'en', name: 'Docs', description: 'D' });
  expect(page.author).toMatchObject({ '@type': 'Person', name: FOUNDER.name });
  expect(page.reviewedBy).toEqual(page.author);
  expect(productTourSchema('th')).toMatchObject({ '@type': 'VideoObject', inLanguage: 'en' });
});
