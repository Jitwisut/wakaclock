'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SYNC_STATUS_HREF } from '@/components/wakaclock/delivery-status-notice';
import { useDeliveryHealth } from '@/hooks/use-delivery-health';
import { cn } from '@/lib/utils';
import { syncSummary, type SyncTone } from '@/lib/wakaclock/delivery-health';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export const TONE_DOT: Record<SyncTone, string> = {
  ok: 'bg-emerald-500',
  syncing: 'bg-amber-500',
  attention: 'bg-red-500',
};

/** Header dot replacing the dashboard delivery banner and toasts: one colour at a
 * glance, the reported cause on click, and the full readout on the Sync page. */
export function SyncStatusIndicator() {
  const userId = useWakaclockUserStore((s) => s.userId);
  const health = useDeliveryHealth();
  if (!userId) return null;
  const summary = syncSummary(health, health.devices);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={`Sync status: ${summary.title}`}
          data-sync-tone={summary.tone}
          size="icon"
          variant="ghost"
        >
          <span className="relative flex size-2.5">
            {summary.tone !== 'ok' && (
              <span
                className={cn(
                  'absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none',
                  TONE_DOT[summary.tone]
                )}
              />
            )}
            <span
              className={cn('relative inline-flex size-2.5 rounded-full', TONE_DOT[summary.tone])}
            />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[summary.tone])} />
          {summary.title}
        </p>
        <p className="text-muted-foreground">{summary.detail}</p>
        <Link
          className="inline-block font-medium underline underline-offset-4"
          href={SYNC_STATUS_HREF}
        >
          Open sync status
        </Link>
      </PopoverContent>
    </Popover>
  );
}
