import { CheckCircle2Icon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { DAILY_QUEST_GOAL_SECONDS } from '@/lib/wakaclock/rpg';

/**
 * "Today's Quest" — reframes today's coding time as a quest with a goal, rather than a
 * bare number. The goal is a fixed default (`DAILY_QUEST_GOAL_SECONDS`), not a setting
 * the user configured — see that constant's doc comment.
 */
export function TodayQuestCard({ isLoading, todaySeconds }: { isLoading?: boolean; todaySeconds: number }) {
  const complete = !isLoading && todaySeconds >= DAILY_QUEST_GOAL_SECONDS;
  const progress = Math.min(1, todaySeconds / DAILY_QUEST_GOAL_SECONDS);
  const goalHours = DAILY_QUEST_GOAL_SECONDS / 3600;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <CardTitle className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
            {complete ? <CheckCircle2Icon aria-hidden className="text-primary size-4" /> : null}
            Today&apos;s quest
          </CardTitle>
          <span className="text-muted-foreground text-xs font-semibold">Code for {goalHours}h</span>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {isLoading ? (
          <Skeleton className="h-3 w-full" />
        ) : (
          <>
            <div
              aria-label="Today's quest progress"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(progress * 100)}
              className="border-border bg-muted h-3 w-full border-2"
              role="progressbar"
            >
              <div
                className={cn('h-full transition-[width] duration-300', complete ? 'bg-primary' : 'bg-secondary')}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs font-semibold">
              {complete
                ? 'Quest complete!'
                : `${formatDurationShort(todaySeconds)} of ${goalHours}h`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
