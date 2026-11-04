import { cn } from '@/lib/utils';

/**
 * A quiet rank for the top rows of ranked lists (Projects, Insights): the top three carry
 * a tinted accent, the rest a muted number, so the list reads as a ranking without
 * medal colours competing with the data.
 */
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
        rank <= 3 ? 'bg-primary/12 text-primary' : 'text-muted-foreground'
      )}
    >
      {rank}
    </span>
  );
}
