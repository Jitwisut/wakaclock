import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AiAttributionLegend } from '@/components/wakaclock/ai-attribution-legend';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

// planai2.md p7.2 (frontend half) — the AI Stats page must explain what evidence
// puts a heartbeat in each attribution class, driven by the userId-scoped
// ai_stats query, and must not name any evidence content.

const PERCENTS = {
  aiInferredPercent: 18,
  aiVerifiedPercent: 42,
  humanPercent: 30,
  unknownPercent: 10,
};

describe('AiAttributionLegend', () => {
  it('names every attribution class and the evidence rule that produces it', () => {
    render(<AiAttributionLegend {...PERCENTS} />);

    expect(screen.getByText('AI verified')).toBeInTheDocument();
    expect(screen.getByText('AI inferred')).toBeInTheDocument();
    expect(screen.getByText('Human')).toBeInTheDocument();
    expect(screen.getByText('Unknown authorship')).toBeInTheDocument();

    expect(screen.getByText(/native agent hook or MCP tool/i)).toBeInTheDocument();
    expect(screen.getByText(/inside the correlation window/i)).toBeInTheDocument();
    expect(screen.getByText(/positive editor keystroke or save/i)).toBeInTheDocument();
    expect(screen.getByText(/authorship could not be proven/i)).toBeInTheDocument();
  });

  it('shows the heartbeat share for each class', () => {
    render(<AiAttributionLegend {...PERCENTS} />);

    expect(screen.getByText('42% of heartbeats')).toBeInTheDocument();
    expect(screen.getByText('18% of heartbeats')).toBeInTheDocument();
    expect(screen.getByText('30% of heartbeats')).toBeInTheDocument();
    expect(screen.getByText('10% of heartbeats')).toBeInTheDocument();
  });

  it('never renders evidence-content vocabulary (privacy contract)', () => {
    render(<AiAttributionLegend {...PERCENTS} />);

    const text = (document.body.textContent ?? '').toLowerCase();
    for (const forbidden of ['diff', 'patch', 'prompt', 'clipboard', 'content', 'source code']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('is fed by a userId-scoped query key (CLAUDE.md rule 6)', () => {
    const key = wakaclockKeys.aiStats('user-a', '2026-01-01', '2026-01-14');
    expect(key).toContain('user-a');
  });
});
