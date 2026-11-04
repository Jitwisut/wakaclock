import { cn } from '@/lib/utils';

const RANK_STYLE: Record<number, string> = {
  1: 'border-amber-500 bg-amber-400/20 text-amber-600 dark:text-amber-400',
  2: 'border-slate-400 bg-slate-300/20 text-slate-500 dark:text-slate-300',
  3: 'border-orange-700 bg-orange-600/20 text-orange-700 dark:text-orange-400',
};

/**
 * A "quest board" rank badge for the top 3 rows of a leaderboard-style table (Projects,
 * Insights). Gold/silver/bronze colour via border/text classes, not emoji — this repo's
 * design guidelines call for SVG/CSS icons over emoji in UI. Ranks below 3 render as a
 * plain muted number so the leaderboard framing doesn't imply everyone "medals".
 */
export function RankBadge({ rank }: { rank: number }) {
  const medalClass = RANK_STYLE[rank];

  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center border-2 text-xs font-bold tabular-nums',
        medalClass ?? 'border-border text-muted-foreground'
      )}
    >
      {rank}
    </span>
  );
}
