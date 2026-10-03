import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AiIntegrationsPanel,
  integrationStatus,
} from '@/components/wakaclock/ai-integrations-panel';
import type { AdapterFreshness, AiDiagnosticsReport } from '@/lib/wakaclock/types';

function adapter(overrides: Partial<AdapterFreshness> = {}): AdapterFreshness {
  return {
    agent: 'codex',
    detected: true,
    enabled: true,
    last_evidence_unix: Math.floor(Date.now() / 1000),
    provider_id: 'openai',
    model_id: 'gpt-5',
    transport: 'native_plugin',
    verification: 'verified',
    ...overrides,
  };
}

function report(adapters: AdapterFreshness[]): AiDiagnosticsReport {
  return {
    adapters,
    broker: {
      inbox_dead_letter: 0,
      inbox_pending: 0,
      inbox_retry: 0,
      last_delivery_unix: null,
      last_error_code: null,
      running: true,
    },
    captured_at: '2026-09-03T00:00:00Z',
    parser: { max_lag_seconds: 0, transcripts_behind: 0, transcripts_watched: 0 },
    schema_version: 1,
  };
}

describe('AiIntegrationsPanel', () => {
  it('renders client/provider/model and a healthy delivered adapter', () => {
    render(
      <AiIntegrationsPanel report={report([adapter({ last_delivery_result: 'delivered' })])} />
    );

    expect(screen.getByRole('region', { name: 'AI integrations' })).toBeInTheDocument();
    expect(screen.getByText('codex')).toBeInTheDocument();
    expect(screen.getByText('openai / gpt-5')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('delivered')).toBeInTheDocument();
  });

  it('shows setup, unsupported and degraded states without guessing provenance', () => {
    const needsSetup = adapter({
      agent: 'kilo-code',
      detected: false,
      last_evidence_unix: null,
      provider_id: null,
      model_id: null,
    });
    const unsupported = adapter({
      agent: 'deep-code',
      diagnostic_code: 'unsupported',
      verification: 'unverified',
    });
    const degraded = adapter({ agent: 'claude-code', retry_events: 2 });
    expect(integrationStatus(needsSetup)).toBe('needs_setup');
    expect(integrationStatus(unsupported)).toBe('unsupported');
    expect(integrationStatus(degraded)).toBe('degraded');

    render(<AiIntegrationsPanel report={report([needsSetup, unsupported, degraded])} />);
    expect(screen.getByText('Needs setup')).toBeInTheDocument();
    expect(screen.getByText('Unsupported')).toBeInTheDocument();
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(
      screen.getAllByText('Provider not reported / Model not reported').length
    ).toBeGreaterThan(0);
  });

  it('shows a policy kill switch separately from trust/setup failures', () => {
    const disabled = adapter({ diagnostic_code: 'disabled_by_policy', enabled: false });
    expect(integrationStatus(disabled)).toBe('disabled');
    render(<AiIntegrationsPanel report={report([disabled])} />);
    expect(screen.getByText('Disabled by policy')).toBeInTheDocument();
  });

  it('distinguishes a missing snapshot from an empty adapter list', () => {
    const { rerender } = render(<AiIntegrationsPanel report={null} />);
    expect(screen.getByText(/No integration health snapshot received/)).toBeInTheDocument();
    rerender(<AiIntegrationsPanel report={report([])} />);
    expect(screen.getByText(/No adapters have been detected yet/)).toBeInTheDocument();
  });

  it('keeps privacy wording free of source-content claims', () => {
    render(<AiIntegrationsPanel report={report([adapter()])} />);
    const body = (document.body.textContent ?? '').toLowerCase();
    expect(body).toContain('never sent');
    expect(body).not.toContain('prompt text');
    expect(body).not.toContain('source code');
  });
});

it.each([
  [{ enabled: false }, 'Needs trust'],
  [{ verification: 'unverified' }, 'Captured locally'],
  [{ last_evidence_unix: null }, 'Unverified'],
  [{ pending_events: 1 }, 'Degraded'],
  [{ dead_letter_events: 1 }, 'Degraded'],
  [{ transcript_lag_seconds: 301 }, 'Degraded'],
  [{ diagnostic_code: 'auth_required' }, 'Degraded'],
] as [Partial<AdapterFreshness>, string][])(
  'shows the bounded integration readiness for %j',
  (overrides, label) => {
    render(<AiIntegrationsPanel report={report([adapter({ transport: null, ...overrides })])} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText('Transport not reported')).toBeVisible();
  }
);
it.each([
  [120, '2m ago'],
  [7200, '2h ago'],
  [172800, '2d ago'],
])('shows evidence age without treating stale capture as recent (%s seconds)', (seconds, label) => {
  render(
    <AiIntegrationsPanel
      report={report([
        adapter({ last_evidence_unix: Math.floor(Date.now() / 1000) - Number(seconds) }),
      ])}
    />
  );
  expect(screen.getByText(label)).toBeVisible();
});
