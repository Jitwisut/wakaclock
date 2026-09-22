import { describe, expect, it, vi } from 'vitest';

import {
  formatAiDetectionReport,
  runAiDetectionSelfTest,
  STALE_EVIDENCE_MS,
} from '../src/aiDetectionSelfTest';
import type { AiDetectionSelfTestDeps } from '../src/aiDetectionSelfTest';

// planai2.md p7.2 — "AtoAxis: Test AI Detection" composes broker + adapter
// status into one pass/degraded/failing verdict, without the extension host.

const NOW = 1_700_000_000_000;

function deps(overrides: Partial<AiDetectionSelfTestDeps> = {}): AiDetectionSelfTestDeps {
  return {
    now: () => NOW,
    getBrokerStatus: vi.fn().mockResolvedValue({
      running: true,
      last_received_at: Math.floor((NOW - 60_000) / 1000),
      inbox: { pending: 0, retry: 0, dead_letter: 0 },
    }),
    getAiAgentStatuses: vi.fn().mockResolvedValue([
      { id: 'claude-code', label: 'Claude Code', provider: 'anthropic', detected: true, enabled: true },
    ]),
    ...overrides,
  };
}

describe('runAiDetectionSelfTest', () => {
  it('reports ok when the broker runs, evidence is fresh and an agent is enabled', async () => {
    const report = await runAiDetectionSelfTest(deps());
    expect(report.verdict).toBe('ok');
    expect(report.checks.every((c) => c.severity === 'ok')).toBe(true);
  });

  it('does not fail when no background process is running in on-demand mode', async () => {
    const report = await runAiDetectionSelfTest(
      deps({
        getBrokerStatus: vi.fn().mockResolvedValue({ running: false, inbox: { dead_letter: 0 } }),
      })
    );
    expect(report.verdict).toBe('degraded');
    expect(report.checks.find((c) => c.id === 'on-demand-sync')?.severity).toBe('ok');
  });

  it('fails with a broker-reachable check when the status call throws', async () => {
    const report = await runAiDetectionSelfTest(
      deps({ getBrokerStatus: vi.fn().mockRejectedValue(new Error('no json on stdout')) })
    );
    expect(report.verdict).toBe('failing');
    const check = report.checks.find((c) => c.id === 'broker-reachable');
    expect(check?.severity).toBe('fail');
    expect(check?.detail).toContain('no json');
  });

  it('degrades (not fails) when the broker runs but there is a dead-letter backlog', async () => {
    const report = await runAiDetectionSelfTest(
      deps({
        getBrokerStatus: vi.fn().mockResolvedValue({
          running: true,
          last_received_at: Math.floor((NOW - 60_000) / 1000),
          inbox: { dead_letter: 3 },
        }),
      })
    );
    expect(report.verdict).toBe('degraded');
    expect(report.checks.find((c) => c.id === 'broker-inbox-draining')?.detail).toContain('3');
  });

  it('degrades when evidence is older than the staleness window', async () => {
    const report = await runAiDetectionSelfTest(
      deps({
        getBrokerStatus: vi.fn().mockResolvedValue({
          running: true,
          last_received_at: Math.floor((NOW - STALE_EVIDENCE_MS - 60_000) / 1000),
          inbox: { dead_letter: 0 },
        }),
      })
    );
    expect(report.verdict).toBe('degraded');
    expect(report.checks.find((c) => c.id === 'recent-evidence')?.severity).toBe('warn');
  });

  it('degrades when no agent is detected, and when a detected agent is not enabled', async () => {
    const none = await runAiDetectionSelfTest(
      deps({ getAiAgentStatuses: vi.fn().mockResolvedValue([]) })
    );
    expect(none.verdict).toBe('degraded');
    expect(none.checks.find((c) => c.id === 'adapters-detected')?.severity).toBe('warn');

    const disabled = await runAiDetectionSelfTest(
      deps({
        getAiAgentStatuses: vi.fn().mockResolvedValue([
          { id: 'codex', label: 'Codex', provider: 'openai', detected: true, enabled: false },
        ]),
      })
    );
    expect(disabled.checks.find((c) => c.id === 'adapters-enabled')?.detail).toContain('Codex');
  });

  it('surfaces the last delivery error when present', async () => {
    const report = await runAiDetectionSelfTest(
      deps({
        getBrokerStatus: vi.fn().mockResolvedValue({
          running: true,
          last_received_at: Math.floor((NOW - 60_000) / 1000),
          inbox: { dead_letter: 0, last_error_message: 'HTTP 402 payment required' },
        }),
      })
    );
    expect(report.checks.find((c) => c.id === 'broker-last-delivery')?.detail).toContain('402');
  });
});

describe('formatAiDetectionReport', () => {
  it('renders a header plus one marked line per check', async () => {
    const report = await runAiDetectionSelfTest(deps());
    const text = formatAiDetectionReport(report);
    expect(text.split('\n')[0]).toBe('AI detection looks healthy.');
    expect(text).toContain('✓ On-demand AI sync available');
  });

  it('never leaks source content', async () => {
    const report = await runAiDetectionSelfTest(deps());
    const text = formatAiDetectionReport(report).toLowerCase();
    for (const forbidden of ['diff', 'patch', 'prompt', 'content', 'source code']) {
      expect(text).not.toContain(forbidden);
    }
  });
});
