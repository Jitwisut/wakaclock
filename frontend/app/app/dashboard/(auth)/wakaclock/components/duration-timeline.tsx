'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { QueryState } from '@/components/wakaclock/query-state';
import { getDurations } from '@/lib/wakaclock/endpoints';
import { formatEpochRange, todayDateString } from '@/lib/wakaclock/format';
import {
  orderedTimelineProjects,
  timelineProjectColor,
  timelineProjectLabel,
  timelineProjectTotals,
} from '@/lib/wakaclock/project-timeline-colors';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { DurationBlock } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

function secondsSinceMidnight(epochSeconds: number) {
  const d = new Date(epochSeconds * 1000);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function formatProjectDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

const DAY_SECONDS = 24 * 3600;
const PROJECT_ROW_HEIGHT = 48;

export function DurationTimeline() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [date, setDate] = React.useState(todayDateString());
  const [timezone, setTimezone] = React.useState<null | string>(null);

  React.useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.durations(userId, date, timezone ?? undefined),
    queryFn: () => getDurations(userId, date, timezone ?? undefined),
    enabled: Boolean(userId && timezone),
  });

  const blocks = data?.data ?? [];
  const projects = orderedTimelineProjects(blocks.map((block) => block.project));
  const projectTotals = timelineProjectTotals(
    blocks.map((block) => ({ durationSeconds: block.duration_seconds, project: block.project }))
  );
  const hasDurationV2 = data?.comparable_seconds != null || data?.ai_additional_seconds != null;

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <CardTitle>Session timeline</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button className="gap-1.5" size="sm" variant="outline">
                <CalendarIcon className="size-3.5" />
                {format(new Date(date), 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                onSelect={(d) => d && setDate(format(d, 'yyyy-MM-dd'))}
                selected={new Date(date)}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          emptyTitle="No sessions on this day"
          error={error}
          isEmpty={timezone !== null && !isLoading && !error && blocks.length === 0}
          isLoading={timezone === null || isLoading}
        >
          <div className="space-y-4">
            {hasDurationV2 && (
              <dl aria-label="Duration comparison" className="grid gap-3 sm:grid-cols-2">
                <div className="bg-muted/30 rounded-lg border px-3 py-2">
                  <dt className="text-muted-foreground text-xs">WakaTime-comparable activity</dt>
                  <dd className="mt-1 text-lg font-semibold">
                    {formatProjectDuration(data?.comparable_seconds ?? 0)}
                  </dd>
                </div>
                <div className="bg-muted/30 rounded-lg border px-3 py-2">
                  <dt className="text-muted-foreground text-xs">Additional measured AI time</dt>
                  <dd className="mt-1 text-lg font-semibold">
                    {formatProjectDuration(data?.ai_additional_seconds ?? 0)}
                  </dd>
                </div>
              </dl>
            )}
            <TooltipProvider>
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[190px_minmax(0,1fr)] items-end">
                    <div />
                    <div className="text-muted-foreground mb-2 grid grid-cols-5 text-[10px]">
                      <span>00:00</span>
                      <span className="text-center">06:00</span>
                      <span className="text-center">12:00</span>
                      <span className="text-center">18:00</span>
                      <span className="text-right">24:00</span>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-md border">
                    {projects.map((project) => {
                      const projectBlocks = blocks.filter(
                        (block) => timelineProjectLabel(block.project) === project
                      );
                      const projectTotal = projectTotals.get(project) ?? 0;
                      const projectColor = timelineProjectColor(project);

                      return (
                        <div
                          className="grid grid-cols-[190px_minmax(0,1fr)] border-b last:border-b-0"
                          key={project}
                        >
                          <div className="bg-card flex min-w-0 items-center gap-2 border-r px-3">
                            <span
                              className="size-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: projectColor }}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{project}</div>
                              <div className="text-muted-foreground text-xs">
                                {formatProjectDuration(projectTotal)}
                              </div>
                            </div>
                          </div>

                          <div
                            className="bg-muted/70 relative overflow-hidden"
                            style={{ height: `${PROJECT_ROW_HEIGHT}px` }}
                          >
                            <div className="pointer-events-none absolute inset-0 grid grid-cols-4">
                              <span className="border-border/50 border-r" />
                              <span className="border-border/50 border-r" />
                              <span className="border-border/50 border-r" />
                              <span />
                            </div>

                            {projectBlocks.map((block: DurationBlock) => {
                              const startPct =
                                (secondsSinceMidnight(block.start) / DAY_SECONDS) * 100;
                              const widthPct = Math.max(
                                (block.duration_seconds / DAY_SECONDS) * 100,
                                0.35
                              );

                              return (
                                <Tooltip key={`${block.entity}-${block.start}-${block.end}`}>
                                  <TooltipTrigger asChild>
                                    <div
                                      aria-label={`${project}, ${formatEpochRange(block.start, block.end)}`}
                                      className="absolute top-2 bottom-2 rounded-sm opacity-90 transition-opacity hover:opacity-100"
                                      role="img"
                                      style={{
                                        backgroundColor: projectColor,
                                        left: `${startPct}%`,
                                        width: `${widthPct}%`,
                                      }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs">
                                      <div className="flex items-center gap-1.5 font-medium">
                                        <span
                                          className="size-2 rounded-sm"
                                          style={{ backgroundColor: projectColor }}
                                        />
                                        {project}
                                      </div>
                                      <div>
                                        {formatEpochRange(block.start, block.end)} ·{' '}
                                        {block.category}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TooltipProvider>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Heartbeats</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.map((block) => {
                    const project = timelineProjectLabel(block.project);
                    return (
                      <TableRow key={`${block.entity}-${block.start}-${block.end}`}>
                        <TableCell className="font-mono text-xs">
                          {formatEpochRange(block.start, block.end)}
                        </TableCell>
                        <TableCell>{Math.round(block.duration_seconds / 60)}m</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-sm"
                              style={{ backgroundColor: timelineProjectColor(block.project) }}
                            />
                            <span>{project}</span>
                          </div>
                        </TableCell>
                        <TableCell>{block.language ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{block.category}</TableCell>
                        <TableCell className="text-right">{block.heartbeat_count}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
}
