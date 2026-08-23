import { FlameIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A flame badge for total days-with-activity. Deliberately labelled "active days," not
 * "streak" — the underlying `all_time.days_with_activity` metric is a count of distinct
 * days with any coding activity, not consecutive days, and calling it a streak would
 * overclaim what the data actually says.
 */
export function ActiveDaysBadge({ days, isLoading }: { days: number; isLoading?: boolean }) {
  const active = !isLoading && days > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border-2 px-2.5 py-1.5 text-xs font-bold whitespace-nowrap',
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
      )}
    >
      <FlameIcon aria-hidden className={cn('size-3.5', active && 'fill-primary')} />
      {isLoading ? '···' : days} active day{days === 1 ? '' : 's'}
    </span>
  );
}
