'use client';

import * as React from 'react';

import {
  ChevronRightIcon,
  GitBranchIcon,
  PencilLineIcon,
  SearchIcon,
  SearchXIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';
import {
  displayEditor,
  EMPTY_HEARTBEAT_FILTER,
  heartbeatAgentLabel,
  type HeartbeatFilter,
  heartbeatHour,
  isAiHeartbeat,
  isFilterActive,
  matchesHeartbeatFilter,
  splitEntityPath,
} from '@/lib/wakaclock/heartbeat-stats';
import {
  timelineProjectColor,
  timelineProjectLabel,
} from '@/lib/wakaclock/project-timeline-colors';
import type { HeartbeatItem } from '@/lib/wakaclock/types';

import styles from '../heartbeats.module.css';

import { formatClock } from './pulse-monitor';

const PAGE = 120;

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function Toggle({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <motion.button
      animate={{ opacity: 1, scale: 1 }}
      aria-label={`Remove filter: ${label}`}
      className="bg-muted hover:bg-muted/70 focus-visible:ring-ring inline-flex h-7 cursor-pointer items-center gap-1 rounded-full pr-1.5 pl-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
      exit={{ opacity: 0, scale: 0.9 }}
      initial={{ opacity: 0, scale: 0.9 }}
      layout
      onClick={onClear}
      type="button"
    >
      {label}
      <XIcon aria-hidden="true" className="size-3" />
      <span className="sr-only">Remove filter</span>
    </motion.button>
  );
}

function StreamRow({
  fresh,
  hb,
  onOpen,
}: {
  fresh: boolean;
  hb: HeartbeatItem;
  onOpen: () => void;
}) {
  const reduced = useReducedMotion();
  const { dir, name } = splitEntityPath(hb.entity);
  const project = timelineProjectLabel(hb.project);
  const ai = isAiHeartbeat(hb);

  return (
    <motion.li
      animate={{ opacity: 1, y: 0 }}
      initial={reduced || !fresh ? false : { opacity: 0, y: -10 }}
      layout={reduced ? false : 'position'}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        className={cn(
          'group hover:bg-muted/60 focus-visible:ring-ring grid w-full cursor-pointer grid-cols-[4.25rem_3px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl px-2 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none sm:px-3',
          fresh && styles.freshRow
        )}
        onClick={onOpen}
        type="button"
      >
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {formatClock(hb.time, true)}
        </span>
        <span
          aria-hidden="true"
          className="h-8 w-[3px] rounded-full"
          style={{ background: timelineProjectColor(hb.project) }}
        />
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm font-medium" title={hb.entity}>
              {name}
            </span>
            {dir && (
              <span className="text-muted-foreground hidden min-w-0 truncate text-xs md:inline">
                {dir}
              </span>
            )}
          </span>
          <span className="text-muted-foreground mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
            <span className="truncate">{project}</span>
            {hb.branch && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <GitBranchIcon aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">{hb.branch}</span>
              </span>
            )}
            {hb.language && <span>{hb.language}</span>}
            <span className="hidden lg:inline">{hb.category}</span>
            <span className="hidden lg:inline">Editor: {displayEditor(hb.editor)}</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          {hb.is_write && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-500/12 px-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              <PencilLineIcon aria-hidden="true" className="size-3" />
              <span className="hidden sm:inline">write</span>
              <span className="sr-only sm:hidden">write</span>
            </span>
          )}
          {ai && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-violet-500/12 px-2 text-[11px] font-medium text-violet-700 dark:text-violet-300">
              <SparklesIcon aria-hidden="true" className="size-3" />
              <span className="max-w-32 truncate">{heartbeatAgentLabel(hb)}</span>
            </span>
          )}
          <ChevronRightIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </span>
      </button>
    </motion.li>
  );
}

export function HeartbeatStream({
  filter,
  freshKeys,
  keys,
  onFilterChange,
  onOpen,
  rows,
}: {
  filter: HeartbeatFilter;
  freshKeys: ReadonlySet<string>;
  keys: readonly string[];
  onFilterChange: (filter: HeartbeatFilter) => void;
  onOpen: (index: number) => void;
  rows: readonly HeartbeatItem[];
}) {
  // The page size resets whenever the filter changes.
  const [paging, setPaging] = React.useState({ filter, limit: PAGE });
  if (paging.filter !== filter) {
    setPaging({ filter, limit: PAGE });
  }
  const limit = paging.filter === filter ? paging.limit : PAGE;

  // Newest first; indices point back into the API's ascending array so row keys
  // stay stable when a refetch appends.
  const matching = React.useMemo(() => {
    const indices: number[] = [];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (matchesHeartbeatFilter(rows[i], filter)) indices.push(i);
    }
    return indices;
  }, [filter, rows]);

  const groups = React.useMemo(() => {
    const out: Array<{ hour: number; indices: number[]; total: number }> = [];
    for (const index of matching.slice(0, limit)) {
      const hour = heartbeatHour(rows[index]);
      const last = out.at(-1);
      if (last?.hour === hour) last.indices.push(index);
      else out.push({ hour, indices: [index], total: 0 });
    }
    const totals = new Map<number, number>();
    for (const index of matching) {
      const hour = heartbeatHour(rows[index]);
      totals.set(hour, (totals.get(hour) ?? 0) + 1);
    }
    // Each displayed group is a subset of the same matching indices counted above.
    for (const group of out) group.total = totals.get(group.hour) as number;
    return out;
  }, [limit, matching, rows]);

  const set = (patch: Partial<HeartbeatFilter>) => onFilterChange({ ...filter, ...patch });
  const chips: Array<{ clear: () => void; key: string; label: string }> = [];
  if (filter.agent !== null) {
    chips.push({ clear: () => set({ agent: null }), key: 'a', label: `Agent: ${filter.agent}` });
  }
  if (filter.project !== null) {
    chips.push({ clear: () => set({ project: null }), key: 'p', label: filter.project });
  }
  if (filter.language !== null) {
    chips.push({ clear: () => set({ language: null }), key: 'l', label: filter.language });
  }
  if (filter.editor !== null) {
    chips.push({ clear: () => set({ editor: null }), key: 'e', label: filter.editor });
  }
  if (filter.hour !== null) {
    chips.push({
      clear: () => set({ hour: null }),
      key: 'h',
      label: `${hourLabel(filter.hour)}–${hourLabel((filter.hour + 1) % 24)}`,
    });
  }

  return (
    <section className="bg-card text-card-foreground flex min-w-0 flex-col rounded-2xl border shadow-xs">
      <header className="flex flex-col gap-4 border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Event stream</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              {isFilterActive(filter)
                ? `${matching.length} of ${rows.length} heartbeats match`
                : `${rows.length} heartbeats · newest first · refreshes every 5 seconds`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-60">
            <SearchIcon
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              aria-label="Search file, project, branch, language, editor or agent"
              className="h-9 rounded-full pl-9"
              onChange={(event) => set({ query: event.target.value })}
              placeholder="Search file, project, agent…"
              type="search"
              value={filter.query}
            />
          </div>
          <Toggle
            active={filter.writesOnly}
            onClick={() => set({ writesOnly: !filter.writesOnly })}
          >
            <PencilLineIcon aria-hidden="true" className="size-3.5" />
            Writes
          </Toggle>
          <Toggle active={filter.aiOnly} onClick={() => set({ aiOnly: !filter.aiOnly })}>
            <SparklesIcon aria-hidden="true" className="size-3.5" />
            AI
          </Toggle>
        </div>
        {isFilterActive(filter) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <AnimatePresence initial={false}>
              {chips.map((chip) => (
                <ActiveChip key={chip.key} label={chip.label} onClear={chip.clear} />
              ))}
            </AnimatePresence>
            <button
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring ml-1 cursor-pointer rounded text-xs underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => onFilterChange(EMPTY_HEARTBEAT_FILTER)}
              type="button"
            >
              Clear all
            </button>
          </div>
        )}
      </header>

      {matching.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-16 text-center text-sm">
          <SearchXIcon aria-hidden="true" className="size-5" />
          No heartbeats match these filters.
        </div>
      ) : (
        <div className="max-h-[680px] overflow-y-auto overscroll-contain px-2 pb-3 sm:px-3">
          {groups.map((group) => (
            <div key={group.hour}>
              <div className="bg-card/85 sticky top-0 z-10 flex items-center gap-3 px-2 pt-4 pb-2 backdrop-blur sm:px-3">
                <span className="font-mono text-xs font-semibold tabular-nums">
                  {hourLabel(group.hour)}
                </span>
                <span className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {group.total} heartbeat{group.total === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="flex flex-col">
                {group.indices.map((index) => (
                  <StreamRow
                    fresh={freshKeys.has(keys[index])}
                    hb={rows[index]}
                    key={keys[index]}
                    onOpen={() => onOpen(index)}
                  />
                ))}
              </ul>
            </div>
          ))}
          {matching.length > limit && (
            <div className="flex justify-center pt-4">
              <Button
                className="rounded-full"
                onClick={() => setPaging({ filter, limit: limit + PAGE })}
                size="sm"
                variant="outline"
              >
                Show {Math.min(PAGE, matching.length - limit)} more
                <span className="text-muted-foreground">({matching.length - limit} left)</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
