'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatSeconds } from '@/lib/wakaclock/format';
import type { EvidenceSplit as EvidenceSplitData } from '@/lib/wakaclock/types';

/**
 * Why a total is the size it is.
 *
 * A WakaTime-compatible total answers "how long" and nothing else, which is why a short
 * session can report hours without the number ever looking wrong: an idle gap under the
 * timeout is credited in full whether the developer was thinking, at lunch, or watching
 * an agent work. The server already partitions that total two ways — measured versus
 * inferred, and human versus agent — and this is the panel that shows it, so the answer
 * to "why did my time jump" is on the same screen as the number that jumped.
 *
 * Both partitions sum to the same `total_seconds`; they are two views of one total, not
 * four separate figures to be added together.
 */

interface Row {
  hint: string;
  key: string;
  label: string;
  seconds: number;
  /** Tailwind background for the meter fill. */
  tone: string;
}

function Meter({ rows, total, title, caption }: {
  caption: string;
  rows: Row[];
  title: string;
  total: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          {title}
        </h3>
        <p className="text-muted-foreground text-xs">{caption}</p>
      </div>
      <div
        aria-hidden
        className="border-border flex h-3 w-full overflow-hidden border-2"
      >
        {rows.map((row) => (
          <div
            className={row.tone}
            key={row.key}
            style={{ width: total > 0 ? `${(row.seconds / total) * 100}%` : '0%' }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {rows.map((row) => (
          <TooltipProvider key={row.key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help items-center gap-2">
                  <span aria-hidden className={`size-2.5 shrink-0 ${row.tone}`} />
                  <div className="min-w-0">
                    <dt className="text-muted-foreground truncate text-xs">{row.label}</dt>
                    <dd className="text-sm font-bold tabular-nums">
                      {formatSeconds(row.seconds)}
                      <span className="text-muted-foreground ml-1 text-xs font-normal">
                        {total > 0 ? `${Math.round((row.seconds / total) * 100)}%` : '0%'}
                      </span>
                    </dd>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{row.hint}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </dl>
    </div>
  );
}

export function EvidenceSplitPanel({ evidence }: { evidence: EvidenceSplitData }) {
  const total = evidence.proven_seconds + evidence.inferred_seconds;

  const measurement: Row[] = [
    {
      hint:
        'Seconds a client actually watched you work — keystrokes, saves, cursor movement. ' +
        'This is the part of the total that is evidence rather than inference.',
      key: 'proven',
      label: 'Measured',
      seconds: evidence.proven_seconds,
      tone: 'bg-primary',
    },
    {
      hint:
        'Pauses the server credited as work because they fell under the idle timeout. ' +
        'WakaTime does the same thing, which is why a 14-minute break between two ' +
        'keystrokes becomes 14 minutes of coding time.',
      key: 'inferred',
      label: 'Inferred from pauses',
      seconds: evidence.inferred_seconds,
      tone: 'bg-muted-foreground/40',
    },
  ];

  const attribution: Row[] = [
    {
      hint: 'Activity from your editor — you were at the keyboard.',
      key: 'attended',
      label: 'You',
      seconds: evidence.attended_seconds,
      tone: 'bg-primary',
    },
    {
      hint:
        'Activity reported by an AI agent hook. The agent was editing files; you may or ' +
        'may not have been watching. Agent pauses are bridged on a much shorter timeout ' +
        'than yours so an unattended run cannot bill as continuous work.',
      key: 'agent',
      label: 'AI agent',
      seconds: evidence.agent_seconds,
      tone: 'bg-chart-2',
    },
    {
      hint:
        'Pauses that span a handover between you and an agent — you prompted, it edited, ' +
        'you picked it back up. Real working time that neither side can claim on its own, ' +
        'so it is reported separately instead of being quietly credited to whichever ' +
        'happened to come first.',
      key: 'other',
      label: 'You + agent',
      seconds: evidence.other_seconds,
      tone: 'bg-chart-4',
    },
  ].filter((row) => row.key !== 'other' || row.seconds > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where this time came from</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Meter
          caption="both bars total the same time"
          rows={measurement}
          title="Evidence"
          total={total}
        />
        <Meter caption="" rows={attribution} title="Attribution" total={total} />
      </CardContent>
    </Card>
  );
}
