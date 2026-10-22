'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDownIcon, CloudUploadIcon, HistoryIcon, InboxIcon, TimerIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DeliveryDiagnostics } from '@/components/wakaclock/delivery-status-notice';
import { QueryState } from '@/components/wakaclock/query-state';
import { StatTile } from '@/components/wakaclock/stat-tile';
import { TONE_DOT } from '@/components/wakaclock/sync-status-indicator';
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

const earliest = (values: Array<null | string | undefined>) =>
  values.filter(Boolean).sort()[0];

const latest = (values: Array<null | string | undefined>) =>
  values
    .filter(Boolean)
    .sort()
    .at(-1);

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

  return (
    <QueryState
      emptyDescription="Once an editor or the CLI sends activity, its queue appears here."
      emptyTitle="No device has reported yet"
      error={error}
      isEmpty={devices.length === 0}
      isLoading={isLoading}
    >
      <div className="flex flex-col gap-4">
        <Card data-sync-tone={summary.tone}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className={cn('size-2.5 shrink-0 rounded-full', TONE_DOT[summary.tone])} />
              {summary.title}
            </CardTitle>
            <CardDescription>{summary.detail}</CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<InboxIcon />}
            label="Waiting on device"
            subtext={deadKnown ? `${health.deadLetter} could not be sent` : undefined}
            tooltip="Heartbeats kept safely on your devices until the server accepts them."
            value={pendingKnown ? health.pending.toLocaleString() : 'Unknown'}
          />
          <StatTile
            icon={<HistoryIcon />}
            label="Oldest unsent"
            value={when(earliest(devices.map((d) => d.oldest_pending_at)))}
          />
          <StatTile
            icon={<TimerIcon />}
            label="Next retry"
            value={when(earliest(devices.map((d) => d.details?.next_retry_at)))}
          />
          <StatTile
            icon={<CloudUploadIcon />}
            label="Last delivered"
            value={when(latest(devices.map((d) => d.last_successful_delivery_at)))}
          />
        </div>

        {devices.map((device) => (
          <Card key={`${device.device_id}-${device.queue_id}`}>
            <CardHeader>
              <CardTitle className="font-mono text-sm">
                Device {device.device_id.slice(0, 8)}
              </CardTitle>
              <CardDescription>
                {device.pending == null ? 'Queue size unknown' : `${device.pending} waiting`} · last
                report {when(device.received_at)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible>
                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-1 text-xs font-medium">
                  Technical details
                  <ChevronDownIcon
                    aria-hidden
                    className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <DeliveryDiagnostics device={device} />
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
      </div>
    </QueryState>
  );
}
