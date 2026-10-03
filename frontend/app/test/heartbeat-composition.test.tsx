import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CompositionCard } from '@/app/dashboard/(auth)/wakaclock/heartbeats/components/composition-card';
import { summarizeHeartbeats } from '@/lib/wakaclock/heartbeat-stats';

const state = vi.hoisted(() => ({ reduced: false }));
vi.mock('@/hooks/use-reduced-motion', () => ({ useReducedMotion: () => state.reduced }));
afterEach(() => {
  state.reduced = false;
});

it.each([false, true])(
  'filters every facet and accounts for entries beyond the visible six (reduced=%s)',
  async (reduced) => {
    state.reduced = reduced;
    const onToggle = vi.fn();
    const summary = {
      ...summarizeHeartbeats([]),
      total: 10,
      aiEvents: 2,
      projects: Array.from({ length: 7 }, (_, i) => ({ label: `project-${i}`, count: i ? 1 : 4 })),
      languages: [{ label: 'Rust', count: 10 }],
      editors: [{ label: 'VS Code', count: 10 }],
      agents: [{ label: 'codex', count: 2 }],
    };
    render(
      <CompositionCard
        active={{ project: 'project-0', language: null, editor: null, agent: null }}
        summary={summary}
        onToggle={onToggle}
      />
    );
    expect(screen.getByText('+1 more · 1 heartbeats')).toBeVisible();
    expect(screen.getByRole('button', { name: /project-0/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await waitFor(() => expect(screen.getByText('40%')).toBeVisible());
    for (const [tab, facet, label] of [
      ['Projects', 'project', 'project-0'],
      ['Languages', 'language', 'Rust'],
      ['Editors', 'editor', 'VS Code'],
      ['AI agents', 'agent', 'codex'],
    ]) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
      expect(onToggle).toHaveBeenLastCalledWith(facet, label);
    }
    await waitFor(() => expect(screen.getByText('100%')).toBeVisible());
    expect(screen.getByText('Share of AI heartbeats · independent of editor')).toBeVisible();
  }
);
it('shows no AI evidence without inferring it from editor activity', () => {
  render(
    <CompositionCard
      active={{ project: null, language: null, editor: null, agent: null }}
      summary={summarizeHeartbeats([])}
      onToggle={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('tab', { name: 'AI agents' }));
  expect(screen.getByText('No AI evidence received for this day.')).toBeVisible();
});
