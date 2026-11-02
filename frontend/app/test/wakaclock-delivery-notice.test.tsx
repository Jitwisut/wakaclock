import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import {
  DeliveryDiagnostics,
  IncompleteTimeBadge,
  SYNC_STATUS_HREF,
} from '@/components/wakaclock/delivery-status-notice';
import type { DeliveryStatusResponse } from '@/lib/wakaclock/measurement-types';

const mock = vi.hoisted(() => ({ incomplete: true }));
vi.mock('@/hooks/use-delivery-health', () => ({
  useDeliveryHealth: () => ({ incomplete: mock.incomplete }),
}));
beforeEach(() => {
  mock.incomplete = true;
});

type Device = DeliveryStatusResponse['devices'][number];
const bare: Device = {
  age_seconds: 0,
  captured_at: '2026-10-22T04:00:00Z',
  received_at: '2026-10-22T04:00:00Z',
  dead_letter: null,
  device_id: 'd45c2c4b-device',
  queue_id: 'queue',
  sequence: 1,
  status: 'fresh',
  retry: null,
  pending: null,
  oldest_pending_at: null,
  last_successful_delivery_at: null,
};

it('marks incomplete totals with a small icon that links to Sync status', () => {
  const view = render(<IncompleteTimeBadge />);
  const link = screen.getByRole('link', { name: /not synced yet/ });
  expect(link).toHaveAttribute('href', SYNC_STATUS_HREF);
  expect(screen.queryByText(/ข้อมูลยังไม่ครบ/)).not.toBeInTheDocument();
  mock.incomplete = false;
  view.rerender(<IncompleteTimeBadge />);
  expect(screen.queryByTestId('incomplete-time-badge')).not.toBeInTheDocument();
});

it('keeps the full technical readout for the Sync status page', () => {
  const view = render(
    <DeliveryDiagnostics
      device={{
        ...bare,
        last_successful_delivery_at: '2026-10-22T04:10:00Z',
        capture: {
          schema_version: 1,
          captured_at: '2026-10-22T04:00:00Z',
          enabled: true,
          status: 'fresh',
          last_scan_success_at: '2026-10-22T04:00:00Z',
          parser_errors: 6,
          pending: 0,
          editor_journal: {
            status: 'stale',
            pending: 0,
            dead_letter: 0,
            last_observed_at: '2026-10-22T04:00:00Z',
          },
          producer_spool: {
            status: 'observed',
            pending: 2,
            accepted: 0,
            failure_count: 0,
            paused_excluded: 0,
            last_scan_success_at: null,
          },
          pipeline: [
            {
              adapter_id: 'codex',
              execution_surface: 'cli',
              stage: 'context',
              status: 'failed',
              pending: null,
              failure_count: 1,
              last_observed_at: '2026-10-22T04:00:00Z',
              oldest_pending_at: null,
              error_code: 'parse',
              version: 'fixture',
            },
            {
              adapter_id: 'claude',
              execution_surface: 'cli',
              stage: 'context',
              status: 'observed',
              pending: 0,
              failure_count: 0,
              last_observed_at: '2026-10-22T04:00:00Z',
              oldest_pending_at: null,
              error_code: null,
              version: 'fixture',
            },
          ],
        },
        details: {
          accepted_total: 37930,
          eligible: 0,
          leased: 0,
          next_retry_at: '2026-10-22T04:20:00Z',
          oldest_event_at: '2026-10-18T09:51:01Z',
          backlog_error: {
            kind: 'server_error',
            message_code: 'http_status',
            http_status: 503,
            failed_at: '2026-10-22T04:14:00Z',
          },
        },
      }}
    />
  );
  const text = view.container.textContent;
  expect(text).toContain('d45c2c4b · capture fresh');
  expect(text).toContain('parser failures 6');
  expect(text).toContain('codex/cli context: failed, pending unknown (parse)');
  expect(text).toContain('claude/cli context: observed, pending 0');
  expect(text).toContain('accepted 37930');
  expect(text).toContain('backlog error http_status (HTTP 503) at ');
  view.rerender(<DeliveryDiagnostics device={bare} />);
  expect(view.container.textContent).toContain('capture unknown · scan unknown');
  expect(view.container.textContent).toContain('context/pipeline details unavailable');
  expect(view.container.textContent).toContain('backlog error — · last accepted —');
});
