'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDownIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DeliveryDiagnostics } from '@/components/wakaclock/delivery-status-notice';
import { QueryState } from '@/components/wakaclock/query-state';
import { TONE_DOT } from '@/components/wakaclock/sync-status-indicator';
import { Widget } from '@/components/wakaclock/workspace';
import { cn } from '@/lib/utils';
import { deliveryHealth, syncSummary } from '@/lib/wakaclock/delivery-health';
import { getDeliveryStatus } from '@/lib/wakaclock/endpoints-v2';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const when = (iso: null | string | undefined) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const earliest = (values: Array<null | string | undefined>) => values.filter(Boolean).sort()[0];

const latest = (values: Array<null | string | undefined>) => values.filter(Boolean).sort().at(-1);

/** Per-device delivery state in plain language; the raw pipeline readout that used to
 * sit on the Overview is kept here behind "Technical details". */
export function SyncStatusPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  // Same key and poll as useDeliveryHealth, so the header dot and this page share one request.
  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.deliveryStatus(userId),
    queryFn: getDeliveryStatus,
    enabled: Boolean(userId),
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
    gcTime: 0,
  });
  const devices = data?.devices ?? [];
  const health = deliveryHealth(data);
  const summary = syncSummary(health, devices);
  const pendingKnown = devices.length > 0 && devices.every((d) => d.pending != null);
  const deadKnown = devices.length > 0 && devices.every((d) => d.dead_letter != null);

  const metrics = [
    {
      hint: deadKnown ? `${health.deadLetter} could not be sent` : undefined,
      label: 'Waiting on device',
      value: pendingKnown ? health.pending.toLocaleString() : 'Unknown',
    },
    { label: 'Oldest unsent', value: when(earliest(devices.map((d) => d.oldest_pending_at))) },
    { label: 'Next retry', value: when(earliest(devices.map((d) => d.details?.next_retry_at))) },
    {
      label: 'Last delivered',
      value: when(latest(devices.map((d) => d.last_successful_delivery_at))),
    },
  ];

  return (
    <QueryState
      emptyDescription="Once an editor or the CLI sends activity, its queue appears here."
      emptyTitle="No device has reported yet"
      error={error}
      isEmpty={devices.length === 0}
      isLoading={isLoading}
    >
      <div className="flex flex-col gap-5">
        <Card
          aria-labelledby="sync-summary-title"
          className="gap-0 overflow-hidden py-0"
          data-sync-tone={summary.tone}
          role="region"
        >
          <div className="flex flex-col gap-1.5 px-5 py-5">
            <h2
              className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
              id="sync-summary-title"
            >
              <span
                aria-hidden
                className={cn('size-2.5 shrink-0 rounded-full', TONE_DOT[summary.tone])}
              />
              {summary.title}
            </h2>
            <p className="text-muted-foreground max-w-2xl text-sm">{summary.detail}</p>
          </div>
          <dl
            aria-label="Delivery totals"
            className="bg-border grid grid-cols-2 gap-px border-t lg:grid-cols-4"
          >
            {metrics.map((metric) => (
              <div className="bg-card flex min-w-0 flex-col gap-1 px-5 py-3.5" key={metric.label}>
                <dt className="text-muted-foreground truncate text-xs">{metric.label}</dt>
                <dd className="text-lg leading-tight font-semibold tracking-tight tabular-nums">
                  {metric.value}
                </dd>
                {metric.hint && (
                  <dd className="text-muted-foreground truncate text-xs">{metric.hint}</dd>
                )}
              </div>
            ))}
          </dl>
        </Card>

        <Widget
          description="Heartbeats are kept on each device until the server accepts them."
          title="Devices"
        >
          <ul aria-label="Devices" className="-mx-4 flex flex-col divide-y border-t sm:-mx-5">
            {devices.map((device) => (
              <li className="px-4 py-3 sm:px-5" key={`${device.device_id}-${device.queue_id}`}>
                <Collapsible>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">
                        Device {device.device_id.slice(0, 8)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {device.pending == null
                          ? 'Queue size unknown'
                          : `${device.pending} waiting`}{' '}
                        · last report {when(device.received_at)}
                      </p>
                    </div>
                    <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium">
                      Technical details
                      <ChevronDownIcon
                        aria-hidden
                        className="size-3.5 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                      />
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="pt-3">
                    <DeliveryDiagnostics device={device} />
                  </CollapsibleContent>
                </Collapsible>
              </li>
            ))}
          </ul>
        </Widget>
      </div>
    </QueryState>
  );
}
