'use client';

import { useEffect } from 'react';

import Link from 'next/link';
import { toast } from 'sonner';

import { useDeliveryHealth } from '@/hooks/use-delivery-health';
import { pipelineTransitionKey } from '@/lib/wakaclock/pipeline-health';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

// Shared across Overview/Heartbeats navigation; unchanged poll results do not
// create another notification. A recovery dismisses the previous warning.
const lastStates = new Map<string, { state: string; key: string }>();
export function DeliveryStatusNotice() {
  const health = useDeliveryHealth();
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const backlogTransition = JSON.stringify(
    health.devices
      .map((d) => [d.device_id, d.details?.backlog_error?.kind ?? null])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  );
  const transition = `${health.state}:${backlogTransition}:${pipelineTransitionKey(health.devices.flatMap((d) => d.capture?.pipeline ?? []))}`;
  useEffect(() => {
    if (!userId) return;
    const previous = lastStates.get(userId);
    if (previous?.key === transition) return;
    lastStates.set(userId, { state: health.state, key: transition });
    const id = `delivery-${userId}`;
    if (health.state === 'complete') {
      toast.dismiss(id);
      if (previous && previous.state !== 'unknown' && previous.state !== 'complete') {
        toast.success('Reported capture and delivery stages recovered.');
      }
    } else if (['warning', 'critical', 'stale', 'unavailable'].includes(health.state)) {
      toast.warning(health.message, { id });
    }
  }, [userId, health.state, health.message, transition]);
  const incompleteStyle = health.incomplete ? 'border-amber-500/50 bg-amber-500/5' : 'bg-muted/30';
  const statusStyle =
    health.state === 'critical' ? 'border-red-500 bg-red-500/10' : incompleteStyle;
  return (
    <aside
      aria-live="polite"
      className={`rounded-lg border p-3 text-sm ${statusStyle}`}
      data-delivery-state={health.state}
      role={health.state === 'critical' ? 'alert' : 'status'}
    >
      <p className="font-medium">
        {health.incomplete ? 'Data incomplete · ข้อมูลยังไม่ครบ' : 'Capture and delivery healthy'}
      </p>
      <p>
        {health.message} Pending:{' '}
        {health.devices.length > 0 && health.devices.every((d) => d.pending != null)
          ? health.pending
          : 'unknown'}{' '}
        · Dead letters:{' '}
        {health.devices.length > 0 && health.devices.every((d) => d.dead_letter != null)
          ? health.deadLetter
          : 'unknown'}
      </p>
      {health.devices.map((device) => (
        <p
          className="text-muted-foreground mt-1 text-xs"
          key={`${device.device_id}-${device.queue_id}`}
        >
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
            ?.map(
              (stage) =>
                `${stage.adapter_id}/${stage.execution_surface} ${stage.stage}: ${stage.status}, pending ${stage.pending ?? 'unknown'}${stage.error_code ? ` (${stage.error_code})` : ''}`
            )
            .join(' · ') ?? 'details unavailable'}
          {' · ready '} {device.details?.eligible ?? 'unknown'} · leased{' '}
          {device.details?.leased ?? 'unknown'}
          {' · accepted '}
          {device.details?.accepted_total ?? 'unknown'}
          {' · next retry '}
          {device.details?.next_retry_at
            ? new Date(device.details.next_retry_at).toLocaleString()
            : '—'}
          {' · oldest event '}
          {device.details?.oldest_event_at
            ? new Date(device.details.oldest_event_at).toLocaleString()
            : '—'}
          {' · backlog error '}
          {device.details?.backlog_error?.message_code ?? '—'}
          {device.details?.backlog_error?.http_status
            ? ` (HTTP ${device.details.backlog_error.http_status})`
            : ''}
          {device.details?.backlog_error?.failed_at
            ? ` at ${new Date(device.details.backlog_error.failed_at).toLocaleString()}`
            : ''}
          {' · last accepted '}
          {device.last_successful_delivery_at
            ? new Date(device.last_successful_delivery_at).toLocaleString()
            : '—'}
        </p>
      ))}
      <Link className="mt-1 inline-block underline" href="/dashboard/wakaclock/analytics/trust">
        Delivery details &amp; recovery
      </Link>
    </aside>
  );
}
export function IncompleteTimeBadge() {
  const { incomplete } = useDeliveryHealth();
  return incomplete ? (
    <span className="text-xs text-amber-700 dark:text-amber-300">
      Data incomplete · ข้อมูลยังไม่ครบ
    </span>
  ) : null;
}
