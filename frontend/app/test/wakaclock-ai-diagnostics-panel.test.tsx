import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AiDiagnosticsPanel } from '@/components/wakaclock/ai-diagnostics-panel';
import type { AiDiagnosticsReport, AiDiagnosticsReportV2 } from '@/lib/wakaclock/types';

function report(): AiDiagnosticsReport {
  return {
    adapters: [
      {
        agent: 'claude-code',
        detected: true,
        enabled: true,
        last_evidence_unix: Math.floor(Date.now() / 1000) - 120,
        verification: 'verified',
      },
    ],
    broker: {
      dead_letter: 0,
      last_delivery_unix: null,
      last_error_code: null,
      pending: 1,
      retry: 0,
      running: true,
    },
    captured_at: '2026-09-05T00:00:00Z',
    parser: {
      max_lag_seconds: 0,
      transcripts_behind: 0,
      transcripts_watched: 2,
    },
    schema_version: 1,
  };
}

function certifiedDegradedReport(): AiDiagnosticsReportV2 {
  const now = '2026-09-06T00:00:00Z';
  return {
    adapters: [
      {
        agent: 'codex',
        availability: 'available',
        certificate_id: 'codex-cli-2026-09-06',
        certification_status: 'certification_verified',
        detected: { availability: 'available', measured_at: now, value: true },
        enabled: { availability: 'available', measured_at: now, value: true },
        runtime_health: 'degraded',
        verification: 'verified',
      },
    ],
    boot_id: 'boot-test',
    broker: {
      availability: 'available',
      dead_letter: { availability: 'available', measured_at: now, value: 0 },
      last_delivery_at: null,
      last_error_code: 'broker_unavailable',
      pending: { availability: 'available', measured_at: now, value: 0 },
      retry: { availability: 'available', measured_at: now, value: 0 },
      running: { availability: 'available', measured_at: now, value: false },
    },
    captured_at: now,
    consent: { adapter_tracking: true, diagnostics_upload: true, observer: true },
    device_id: 'device-test',
    measured_at: now,
    parser: {
      availability: 'available',
      max_lag_seconds: { availability: 'available', measured_at: now, value: 0 },
      transcripts_behind: { availability: 'available', measured_at: now, value: 0 },
      transcripts_watched: { availability: 'available', measured_at: now, value: 1 },
    },
    runtime_health: 'degraded',
    schema_version: 2,
    sequence: 1,
  };
}

describe('AiDiagnosticsPanel', () => {
  it('renders bounded broker, parser and adapter health', () => {
    render(<AiDiagnosticsPanel report={report()} />);

    expect(screen.getByText('Local AI diagnostics')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText(/1 pending · 0 retry · 0 dead-letter/)).toBeInTheDocument();
    expect(screen.getByText(/2 watched · 0 behind/)).toBeInTheDocument();
    expect(screen.getByText('claude-code')).toBeInTheDocument();
    expect(screen.getByText(/detected · enabled · Verified/)).toBeInTheDocument();
  });

  it('does not treat an absent snapshot as an attribution failure', () => {
    render(<AiDiagnosticsPanel report={null} />);

    expect(screen.getByText('No diagnostics snapshot')).toBeInTheDocument();
    expect(screen.getByText(/Run wakaclock ai doctor/)).toBeInTheDocument();
  });

  it('surfaces degraded broker/parser state without local evidence', () => {
    render(
      <AiDiagnosticsPanel
        report={{
          ...report(),
          broker: {
            ...report().broker,
            dead_letter: 2,
            last_error_code: 'http_503',
            running: false,
          },
          parser: {
            max_lag_seconds: 42,
            transcripts_behind: 1,
            transcripts_watched: 3,
          },
        }}
      />
    );

    expect(screen.getByText('stopped')).toBeInTheDocument();
    expect(screen.getByText('last error: http_503')).toBeInTheDocument();
    expect(screen.getByText(/3 watched · 1 behind/)).toBeInTheDocument();
    expect(screen.getByText('max lag 42s')).toBeInTheDocument();
  });

  it('keeps a reviewed capability certified while showing degraded runtime health', () => {
    render(<AiDiagnosticsPanel report={certifiedDegradedReport()} />);

    expect(
      screen.getByText(/Certified · codex-cli-2026-09-06 · runtime degraded/)
    ).toBeInTheDocument();
    expect(screen.getByText('stopped')).toBeInTheDocument();
  });

  it('renders every device and keeps idle/unavailable capability states separate', () => {
    const first = certifiedDegradedReport();
    const second: AiDiagnosticsReportV2 = {
      ...first,
      adapters: [
        {
          agent: 'gemini-cli',
          availability: 'unavailable',
          detected: { availability: 'unavailable', measured_at: null, value: null },
          diagnostic_code: 'auth_required',
          enabled: { availability: 'unavailable', measured_at: null, value: null },
          runtime_health: 'idle',
          verification: 'unverified',
        },
      ],
      consent: { adapter_tracking: true, diagnostics_upload: true, observer: true },
      device_id: 'device-second',
      runtime_health: 'idle',
    };

    render(<AiDiagnosticsPanel report={first} reports={[first, second]} />);

    expect(screen.getByRole('article', { name: 'Device device-test' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Device device-second' })).toBeInTheDocument();
    expect(screen.getByText('Ready · idle')).toBeInTheDocument();
    expect(screen.getByText('Measurement unavailable')).toBeInTheDocument();
    expect(screen.getByText('Certification not reported')).toBeInTheDocument();
    expect(screen.getByText('Advanced details')).toBeInTheDocument();
    expect(screen.queryByText('No adapters reported yet.')).not.toBeInTheDocument();
  });

  it('shows a bounded repair action when a device has no adapter capability', () => {
    const reportWithNoAdapters: AiDiagnosticsReportV2 = {
      ...certifiedDegradedReport(),
      adapters: [],
      device_id: 'device-empty',
      runtime_health: 'unavailable',
    };

    render(<AiDiagnosticsPanel report={reportWithNoAdapters} />);

    expect(screen.getByText('Observer unavailable')).toBeInTheDocument();
    expect(screen.getByText('No adapters reported yet.')).toBeInTheDocument();
  });
});
