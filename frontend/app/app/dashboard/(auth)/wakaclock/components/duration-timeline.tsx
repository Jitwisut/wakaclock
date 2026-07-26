'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { QueryState } from '@/components/wakaclock/query-state';
import { cn } from '@/lib/utils';
import { getDurations } from '@/lib/wakaclock/endpoints';
import { formatEpochRange , todayDateString } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { DurationBlock } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const CATEGORY_COLORS: Record<string, string> = {
  coding: 'bg-[var(--chart-1)]',
  building: 'bg-[var(--chart-2)]',
  debugging: 'bg-[var(--chart-3)]',
  designing: 'bg-[var(--chart-4)]',
  modeling: 'bg-[var(--chart-5)]',
  meeting: 'bg-muted-foreground/40',
  communicating: 'bg-muted-foreground/60',
};

function categoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? 'bg-primary';
}

function secondsSinceMidnight(epochSeconds: number) {
  const d = new Date(epochSeconds * 1000);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

const DAY_SECONDS = 24 * 3600;

export function DurationTimeline() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [date, setDate] = React.useState(todayDateString());

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.durations(userId, date),
    queryFn: () => getDurations(userId, date),
    enabled: Boolean(userId),
  });

  const blocks = data?.data ?? [];
  const categories = [...new Set(blocks.map((b) => b.category))];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Session timeline</CardTitle>
            <CardDescription>GET /durations</CardDescription>
          </div>
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
          isEmpty={!isLoading && !error && blocks.length === 0}
          isLoading={isLoading}
        >
          <div className="space-y-4">
            <TooltipProvider>
              <div>
                <div className="text-muted-foreground mb-1.5 flex justify-between text-[10px]">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>24:00</span>
                </div>
                <div className="bg-muted relative h-10 w-full overflow-hidden rounded-md">
                  {blocks.map((block: DurationBlock) => {
                    const startPct = (secondsSinceMidnight(block.start) / DAY_SECONDS) * 100;
                    const widthPct = Math.max(
                      (block.duration_seconds / DAY_SECONDS) * 100,
                      0.4
                    );
                    return (
                      <Tooltip key={`${block.entity}-${block.start}-${block.end}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'absolute inset-y-0 rounded-sm opacity-90 transition-opacity hover:opacity-100',
                              categoryColor(block.category)
                            )}
                            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <div className="font-medium">
                              {block.project ?? block.entity}
                            </div>
                            <div>
                              {formatEpochRange(block.start, block.end)} · {block.category}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </TooltipProvider>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-3 text-xs">
                {categories.map((category) => (
                  <div className="flex items-center gap-1.5" key={category}>
                    <span className={cn('size-2.5 rounded-sm', categoryColor(category))} />
                    <span className="text-muted-foreground">{category}</span>
                  </div>
                ))}
              </div>
            )}

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
                  {blocks.map((block) => (
                    <TableRow key={`${block.entity}-${block.start}-${block.end}`}>
                      <TableCell className="font-mono text-xs">
                        {formatEpochRange(block.start, block.end)}
                      </TableCell>
                      <TableCell>{Math.round(block.duration_seconds / 60)}m</TableCell>
                      <TableCell>{block.project ?? '—'}</TableCell>
                      <TableCell>{block.language ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{block.category}</TableCell>
                      <TableCell className="text-right">{block.heartbeat_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
}
