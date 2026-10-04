import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnswerGuide } from '@/components/marketing/answer-guide';
import { webPageSchema } from '@/lib/seo/schema';
import { contentModified } from '@/lib/seo/site';
import * as site from '@/lib/seo/site';

describe('audit answer guides', () => {
  it('uses the documented site review date when a guide has no dedicated content date', () => {
    const dates = vi.spyOn(site, 'contentModified').mockReturnValue(undefined);
    try {
      const { container } = render(<AnswerGuide path="/teams" />);
      expect(container.querySelector('time')).toHaveAttribute('datetime', site.SITE_MODIFIED);
      expect(container.querySelector('time')).toHaveTextContent(site.SITE_MODIFIED);
    } finally {
      dates.mockRestore();
    }
  });
  it.each([
    '/',
    '/teams',
    '/developer-analytics',
    '/wakatime-alternative',
    '/ai-coding-tracker',
    '/pricing',
    '/integrations',
    '/docs',
    '/about',
    '/contact',
    '/terms',
    '/privacy',
    '/early-access',
    '/docs/getting-started',
    '/integrations/vscode',
  ])('renders extractable facts, a comparison and attributed sources on %s', (path) => {
    const { container } = render(<AnswerGuide path={path} />);
    expect(container.querySelectorAll('dt')).toHaveLength(4);
    expect(container.querySelectorAll('dd')).toHaveLength(4);
    expect(container.querySelector('table caption')).not.toBeNull();
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
      contentModified(path, 'en')
    );
    expect(container.querySelectorAll('a[href^="/"], a[href^="https://"]')).not.toHaveLength(0);
    expect(container.textContent).toContain('illustrative, not customer research');
  });

  it('renders a Thai answer, table and sources on the Thai homepage', () => {
    const { container } = render(<AnswerGuide locale="th" path="/" />);

    expect(container.textContent).toContain('สรุปสาระสำคัญ');
    expect(container.querySelectorAll('dt')).toHaveLength(4);
    expect(container.querySelector('table caption')?.textContent).toContain('ตีความ');
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
      contentModified('/', 'th')
    );
    expect(container.textContent).toContain('ไม่ใช่งานวิจัยหรือข้อมูลลูกค้า');
  });

  it.each(['/wakatime-alternative', '/ai-coding-tracker'])(
    'renders a Thai guide with facts, table and sources on %s, without leaning on the shared English fallback',
    (path) => {
      const { container } = render(<AnswerGuide locale="th" path={path} />);

      expect(container.querySelectorAll('dt')).toHaveLength(4);
      expect(container.querySelector('table caption')?.textContent).toContain('ตีความ');
      expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
        contentModified(path, 'th')
      );
      expect(container.querySelectorAll('a[href^="/"]').length).toBeGreaterThan(0);
    }
  );

  it('does not render a guide for a Thai route with no dedicated guide', () => {
    const { container } = render(<AnswerGuide locale="th" path="/unsupported-fixture" />);
    expect(container.querySelector('#answer-guide')).toBeNull();
  });

  it('keeps the highest brand-keyword-density page from repeating "WakaTime" in its default sources', () => {
    const { container } = render(<AnswerGuide locale="th" path="/wakatime-alternative" />);
    const sourceLabels = Array.from(container.querySelectorAll('a')).map((a) => a.textContent);
    expect(sourceLabels.some((label) => label?.includes('WakaTime'))).toBe(false);
  });

  it('does not invent a content update for untouched translations', () => {
    const page = { path: '/contact', name: 'Contact', description: 'Contact AtoAxis' };
    expect(webPageSchema({ ...page, locale: 'en' }).dateModified).toBe(
      contentModified('/contact', 'en')
    );
    expect(webPageSchema({ ...page, locale: 'th' })).not.toHaveProperty('dateModified');
  });
});
