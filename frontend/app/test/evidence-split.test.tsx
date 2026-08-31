import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EvidenceSplitPanel } from '@/components/wakaclock/evidence-split';

/**
 * The numbers below are a real day from docs/duration-accuracy-audit.md: 2h54m reported
 * from 35 minutes of human activity, the rest emitted by an agent hook. That day is the
 * whole reason this panel exists — the total looked like a normal working afternoon and
 * the dashboard gave no way to tell that four fifths of it was an agent running
 * unattended.
 */
const AGENT_HEAVY_DAY = {
  ai_coding_seconds: 5300,
  ai_session_seconds: 7000,
  agent_seconds: 8353,
  attended_seconds: 2118,
  inferred_seconds: 4267,
  other_seconds: 0,
  proven_seconds: 6203,
};

describe('EvidenceSplitPanel', () => {
  it('shows how much of the total was measured rather than inferred', () => {
    render(<EvidenceSplitPanel evidence={AGENT_HEAVY_DAY} />);

    expect(screen.getByText('Measured')).toBeInTheDocument();
    expect(screen.getByText('Inferred from pauses')).toBeInTheDocument();
    expect(screen.getByText('AI coding')).toBeInTheDocument();
    expect(screen.getByText('AI session')).toBeInTheDocument();
    // 6203s of 10470s total.
    expect(screen.getByText('59%')).toBeInTheDocument();
  });

  it('names the agent share, which is the part a WakaTime-shaped total hides', () => {
    render(<EvidenceSplitPanel evidence={AGENT_HEAVY_DAY} />);

    expect(screen.getByText('AI agent')).toBeInTheDocument();
    // 8353s of the same 10470s total — the number that explains a "jumping" clock.
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  /**
   * Both partitions are shares of one total, so they must be measured against
   * `proven + inferred` and never against their own subtotal. Dividing the attribution
   * row by `attended + agent` would silently renormalise it and the two bars would stop
   * describing the same time.
   */
  it('measures both partitions against the same total', () => {
    render(<EvidenceSplitPanel evidence={AGENT_HEAVY_DAY} />);

    const percentages = screen
      .getAllByText(/^\d+%$/)
      .map((node) => Number.parseInt(node.textContent ?? '0', 10));

    // Evidence rows sum to 100; attribution rows sum to 100 against the same denominator.
    expect(percentages[0] + percentages[1]).toBe(100);
    // The fixture has no non-zero handover row, so attribution has two rows. The
    // two additive AI metrics below use a different denominator and are not a
    // partition of the total.
    expect(percentages[2] + percentages[3]).toBe(100);
  });

  it('hides the handover row when no pause spanned one', () => {
    render(<EvidenceSplitPanel evidence={AGENT_HEAVY_DAY} />);

    expect(screen.queryByText('You + agent')).not.toBeInTheDocument();
  });

  /**
   * A pause between you typing and an agent editing is real work that belongs to neither
   * side. Crediting it to whichever came first is what used to report 9h38m of human time
   * on an editor stream that could only support 7h21m, so it gets its own row.
   */
  it('names the human/agent handover as its own share', () => {
    render(
      <EvidenceSplitPanel
        evidence={{
          ai_coding_seconds: 2500,
          ai_session_seconds: 4000,
          agent_seconds: 3000,
          attended_seconds: 5000,
          inferred_seconds: 6000,
          other_seconds: 2000,
          proven_seconds: 4000,
        }}
      />
    );

    expect(screen.getByText('You + agent')).toBeInTheDocument();
    // 2000 of 10000.
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('renders a zero total without dividing by zero', () => {
    render(
      <EvidenceSplitPanel
        evidence={{
          ai_coding_seconds: 0,
          ai_session_seconds: 0,
          agent_seconds: 0,
          attended_seconds: 0,
          inferred_seconds: 0,
          other_seconds: 0,
          proven_seconds: 0,
        }}
      />
    );

    expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
  });
});
