'use client';

import { CloudAlertIcon } from 'lucide-react';
import Link from 'next/link';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeliveryHealth } from '@/hooks/use-delivery-health';

export const SYNC_STATUS_HREF = '/dashboard/wakaclock/sync';

type DeliveryDevice = ReturnType<typeof useDeliveryHealth>['devices'][number];

const when = (iso: null | string | undefined) => (iso ? new Date(iso).toLocaleString() : '—');

/** The full per-device pipeline readout. Shown only on the Sync status page,
 * behind "Technical details", so the dashboard itself stays free of it. */
export function DeliveryDiagnostics({ device }: { device: DeliveryDevice }) {
  return (
    <p className="text-muted-foreground text-xs break-words">
      {device.device_id.slice(0, 8)} · capture {device.capture?.status ?? 'unknown'}
      {' · scan '}
      {device.capture?.last_scan_success_at
        ? new Date(device.capture.last_scan_success_at).toLocaleString()
        : 'unknown'}
      {' · parser failures '}
      {device.capture?.parser_errors ?? 'unknown'}
      {' · capture pending '}
      {device.capture?.pending ?? 'unknown'}
      {' · producer spool '}
      {device.capture?.producer_spool?.status ?? 'unknown'}
      {' · producer pending '}
      {device.capture?.producer_spool?.pending ?? 'unknown'}
      {' · editor journal '}
      {device.capture?.editor_journal?.status ?? 'unknown'}
      {' · editor handoff pending '}
      {device.capture?.editor_journal?.pending ?? 'unknown'}
      {' · context/pipeline '}
      {device.capture?.pipeline
        ?.map((stage) => {
          const error = stage.error_code ? ` (${stage.error_code})` : '';
          return `${stage.adapter_id}/${stage.execution_surface} ${stage.stage}: ${stage.status}, pending ${stage.pending ?? 'unknown'}${error}`;
        })
        .join(' · ') ?? 'details unavailable'}
      {' · ready '} {device.details?.eligible ?? 'unknown'} · leased{' '}
      {device.details?.leased ?? 'unknown'}
      {' · accepted '}
      {device.details?.accepted_total ?? 'unknown'}
      {' · next retry '}
      {when(device.details?.next_retry_at)}
      {' · oldest event '}
      {when(device.details?.oldest_event_at)}
      {' · backlog error '}
      {device.details?.backlog_error?.message_code ?? '—'}
      {device.details?.backlog_error?.http_status
        ? ` (HTTP ${device.details.backlog_error.http_status})`
        : ''}
      {device.details?.backlog_error?.failed_at
        ? ` at ${when(device.details.backlog_error.failed_at)}`
        : ''}
      {' · last accepted '}
      {when(device.last_successful_delivery_at)}
    </p>
  );
}

const INCOMPLETE_HINT = 'Some activity has not synced yet. Totals may rise once it arrives.';

/** Marks a time total that may still grow while queued activity is delivered.
 * Same condition as before (`incomplete`); a small icon instead of a text label. */
export function IncompleteTimeBadge() {
  const { incomplete } = useDeliveryHealth();
  if (!incomplete) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          aria-label={INCOMPLETE_HINT}
          className="inline-flex align-middle text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          data-testid="incomplete-time-badge"
          href={SYNC_STATUS_HREF}
        >
          <CloudAlertIcon aria-hidden className="size-3.5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{INCOMPLETE_HINT}</TooltipContent>
    </Tooltip>
  );
}
