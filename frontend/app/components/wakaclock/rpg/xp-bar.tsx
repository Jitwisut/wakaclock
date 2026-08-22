import { levelProgressForSeconds } from '@/lib/wakaclock/rpg';

/**
 * Character-sheet-style Level + XP bar, driven entirely by `all_time.total_seconds` —
 * see `lib/wakaclock/rpg.ts` for the level curve. Purely a framing layer over the same
 * all-time total the dashboard already shows; it does not track anything new.
 */
export function XpBar({ isLoading, totalSeconds }: { isLoading?: boolean; totalSeconds: number }) {
  const { level, hoursIntoLevel, hoursForLevel, progress } = levelProgressForSeconds(totalSeconds);

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="border-border bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center border-2 text-base font-bold"
      >
        {isLoading ? '–' : level}
      </span>
      <div className="min-w-40 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-xs font-bold">
          <span>Level {isLoading ? '–' : level}</span>
          <span className="text-muted-foreground font-normal">
            {isLoading ? '···' : `${hoursIntoLevel.toFixed(1)}h / ${hoursForLevel}h to next level`}
          </span>
        </div>
        <div
          aria-label={`Level ${level} progress`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(progress * 100)}
          className="border-border bg-muted mt-1.5 h-3 w-full border-2"
          role="progressbar"
        >
          <div
            className="bg-primary h-full transition-[width] duration-300"
            style={{ width: `${isLoading ? 0 : progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
