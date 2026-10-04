import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { SessionTimelineTooltip } from '@/app/dashboard/(auth)/wakaclock/components/session-timeline-tooltip';
import { BrandMark } from '@/components/marketing/brand-mark';
import { FaqSection } from '@/components/marketing/faq-section';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RankBadge } from '@/components/wakaclock/rpg/rank-badge';
import { TodayQuestCard } from '@/components/wakaclock/rpg/today-quest-card';
import { StatTile } from '@/components/wakaclock/stat-tile';
import { localizedPath } from '@/lib/seo/site';
import { aiRuntimeGuidance } from '@/lib/wakaclock/ai-display';
import { levelProgressForSeconds } from '@/lib/wakaclock/rpg';
import type { AiRuntimeHealth } from '@/lib/wakaclock/types';

it('keeps zero-denominator session shares finite and names languages hidden by the compact list', () => {
  render(
    <Tooltip open>
      <TooltipTrigger>Session</TooltipTrigger>
      <SessionTimelineTooltip
        color="#112233"
        duration="0m"
        projectTotal={0}
        session={{
          start: 1790899200,
          end: 1790899200,
          duration_seconds: 0,
          heartbeat_count: 1,
          categories: ['coding'],
          project: 'Measured zero',
          languages: ['Rust', 'TypeScript', 'CSS', 'HTML', 'SQL'],
        }}
      />
    </Tooltip>
  );
  const tooltip = screen.getByTestId('tooltip-content');
  expect(tooltip).toHaveTextContent('0.0%');
  expect(tooltip).toHaveTextContent('Continuous activity');
  expect(tooltip.querySelector('[title="HTML, SQL"]')).toHaveTextContent('+2 more');
});

it('caps a completed daily quest at 100% and shows completion text', () => {
  render(<TodayQuestCard todaySeconds={10_800} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByText('Quest complete!')).toBeVisible();
});

it('shows a plain rank outside the medal places', () => {
  render(<RankBadge rank={4} />);
  expect(screen.getByText('4')).toHaveClass('text-muted-foreground');
});

it('renders optional page actions and an accessible explanation for unavailable metrics', () => {
  render(<WakaclockPageHeader title="Sessions" actions={<button>Refresh sessions</button>} />);
  render(<StatTile label="Agent execution" value="Unavailable" tooltip="No execution intervals" />);
  expect(screen.getByRole('button', { name: 'Refresh sessions' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'No execution intervals' })).toBeVisible();
  expect(screen.getByText('Unavailable')).toBeVisible();
});

it('keeps identical FAQ entries visible without duplicate React keys', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const entry = { question: 'Is execution measured?', answer: 'Only with interval evidence.' };
  render(<FaqSection entries={[entry, entry]} />);
  expect(screen.getAllByText(entry.question)).toHaveLength(2);
  expect(errors.mock.calls.flat().join(' ')).not.toContain('same key');
});

it.each([false, true])('keeps the brand image decorative (preload=%s)', (preload) => {
  const { container } = render(<BrandMark preload={preload} />);
  expect(container.querySelector('img')).toHaveAttribute('alt', '');
  expect(container.querySelector('img')).toHaveAttribute('aria-hidden', 'true');
});

it('normalizes relative localized links and handles future runtime states conservatively', () => {
  expect(localizedPath('th', 'docs')).toBe('/th/docs');
  expect(localizedPath('en', 'docs')).toBe('/docs');
  expect(aiRuntimeGuidance('future_state' as AiRuntimeHealth)).toMatchObject({
    label: 'No action reported',
    tone: 'neutral',
  });
  expect(levelProgressForSeconds(Number.NaN).progress).toBe(0);
});
