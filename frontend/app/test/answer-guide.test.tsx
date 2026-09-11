import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnswerGuide } from '@/components/marketing/answer-guide';
import { webPageSchema } from '@/lib/seo/schema';
import { contentModified } from '@/lib/seo/site';

describe('audit answer guides', () => {
  it.each(['/', '/teams', '/developer-analytics', '/wakatime-alternative', '/ai-coding-tracker'])(
    'renders extractable facts, a comparison and attributed sources on %s',
    (path) => {
      const { container } = render(<AnswerGuide path={path} />);
      expect(container.querySelectorAll('dt')).toHaveLength(4);
      expect(container.querySelectorAll('dd')).toHaveLength(4);
      expect(container.querySelector('table caption')).not.toBeNull();
      expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
        contentModified(path, 'en')
      );
      expect(container.querySelector('a[href="https://wakatime.com/developers"]')).not.toBeNull();
      expect(container.textContent).toContain('illustrative, not customer research');
    }
  );

  it('does not invent a content update for untouched translations', () => {
    const page = { path: '/teams', name: 'Teams', description: 'Team prototype' };
    expect(webPageSchema({ ...page, locale: 'en' }).dateModified).toBe('2026-09-11');
    expect(webPageSchema({ ...page, locale: 'th' })).not.toHaveProperty('dateModified');
  });
});
