import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AiDiagnosticsPanel } from '@/components/wakaclock/ai-diagnostics-panel';
import { getAiDiagnostics } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { AiDiagnosticsReport } from '@/lib/wakaclock/types';

// planai2.md p7.2c (frontend) — the AI Stats page shows local broker / parser /
// adapter health pushed from `wakaclock doctor ai`, behind a userId-scoped
// query.

const NOW_UNIX = Math.floor(Date.now() / 1000);

function report(overrides: Partial<AiDiagnosticsReport> = {}): AiDiagnosticsReport {
  return {
    adapters: [
      {
        agent: 'claude-code',
        detected: true,
        enabled: true,
        last_evidence_unix: NOW_UNIX - 120,
        verification: 'verified',
      },
    ],
    broker: {
      inbox_dead_letter: 0,
      inbox_pending: 1,
      inbox_retry: 0,
      last_delivery_unix: NOW_UNIX - 60,
      last_error_code: null,
      running: true,
    },
    captured_at: '2026-09-02T00:00:00Z',
    parser: { max_lag_seconds: 0, transcripts_behind: 0, transcripts_watched: 2 },
    schema_version: 1,
    ...overrides,
  };
}

describe('AiDiagnosticsPanel', () => {
  it('renders broker, parser and adapter health from a report', () => {
    render(<AiDiagnosticsPanel report={report()} />);

    expect(screen.getByText('Local detection health')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText(/1 pending · 0 retry · 0 dead-letter/)).toBeInTheDocument();
    expect(screen.getByText(/2 watched · 0 behind/)).toBeInTheDocument();
    expect(screen.getByText('claude-code')).toBeInTheDocument();
    expect(screen.getByText(/detected · enabled · verified/)).toBeInTheDocument();
  });

  it('surfaces a stopped broker, a dead-letter backlog and an error code', () => {
    render(
      <AiDiagnosticsPanel
        report={report({
          broker: {
            inbox_dead_letter: 3,
            inbox_pending: 0,
            inbox_retry: 1,
            last_delivery_unix: null,
            last_error_code: 'http_402',
            running: false,
          },
        })}
      />
    );

    expect(screen.getByText('stopped')).toBeInTheDocument();
    expect(screen.getByText(/0 pending · 1 retry · 3 dead-letter/)).toBeInTheDocument();
    expect(screen.getByText('last error: http_402')).toBeInTheDocument();
  });

  it('flags transcript-parser lag', () => {
    render(
      <AiDiagnosticsPanel
        report={report({
          parser: { max_lag_seconds: 42, transcripts_behind: 1, transcripts_watched: 3 },
        })}
      />
    );

    expect(screen.getByText(/3 watched · 1 behind/)).toBeInTheDocument();
    expect(screen.getByText('max lag 42s')).toBeInTheDocument();
  });

  it('shows guidance when no snapshot has been pushed', () => {
    render(<AiDiagnosticsPanel report={null} />);

    expect(screen.getByText(/No local diagnostics received yet/)).toBeInTheDocument();
    expect(screen.getByText('wakaclock doctor ai')).toBeInTheDocument();
  });

  it('never renders evidence-content vocabulary (privacy contract)', () => {
    render(<AiDiagnosticsPanel report={report()} />);

    const text = (document.body.textContent ?? '').toLowerCase();
    for (const forbidden of ['diff', 'patch', 'prompt', 'clipboard', 'transcript line']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('is fed by a userId-scoped query key and endpoint (CLAUDE.md rule 6)', () => {
    const key = wakaclockKeys.aiDiagnostics('user-a');
    expect(key).toContain('user-a');
    expect(typeof getAiDiagnostics).toBe('function');
  });
});
