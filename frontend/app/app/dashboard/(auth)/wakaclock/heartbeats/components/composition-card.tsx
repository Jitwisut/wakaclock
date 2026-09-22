'use client';

import * as React from 'react';

import { motion } from 'motion/react';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';
import type { CountEntry, HeartbeatSummary } from '@/lib/wakaclock/heartbeat-stats';
import { timelineProjectColor } from '@/lib/wakaclock/project-timeline-colors';

export type CompositionFacet = 'editor' | 'language' | 'project';

const FACETS: Array<{ key: CompositionFacet; label: string }> = [
  { key: 'project', label: 'Projects' },
  { key: 'language', label: 'Languages' },
  { key: 'editor', label: 'Editors' },
];

const VISIBLE = 6;

function entriesFor(summary: HeartbeatSummary, facet: CompositionFacet): CountEntry[] {
  if (facet === 'project') return summary.projects;
  if (facet === 'language') return summary.languages;
  return summary.editors;
}

export function CompositionCard({
  active,
  onToggle,
  summary,
}: {
  active: Record<CompositionFacet, null | string>;
  onToggle: (facet: CompositionFacet, value: string) => void;
  summary: HeartbeatSummary;
}) {
  const reduced = useReducedMotion();
  const [facet, setFacet] = React.useState<CompositionFacet>('project');
  const entries = entriesFor(summary, facet);
  const visible = entries.slice(0, VISIBLE);
  const rest = entries.slice(VISIBLE).reduce((sum, e) => sum + e.count, 0);
  const total = Math.max(1, summary.total);

  return (
    <section className="bg-card text-card-foreground flex min-w-0 flex-col gap-4 rounded-2xl border p-5 shadow-xs sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Composition</h2>
          <p className="text-muted-foreground mt-1 text-xs">Share of heartbeats</p>
        </div>
        <div
          aria-label="Group heartbeats by"
          className="bg-muted relative flex rounded-lg p-0.5"
          role="tablist"
        >
          {FACETS.map((f) => (
            <button
              aria-selected={facet === f.key}
              className={cn(
                'relative cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                facet === f.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              key={f.key}
              onClick={() => setFacet(f.key)}
              role="tab"
              type="button"
            >
              {facet === f.key && (
                <motion.span
                  className="bg-background absolute inset-0 rounded-md shadow-sm"
                  layoutId="hb-composition-tab"
                  transition={reduced ? { duration: 0 } : { bounce: 0.2, type: 'spring' }}
                />
              )}
              <span className="relative">{f.label}</span>
            </button>
          ))}
        </div>
      </header>

      <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {visible.map((e) => (
          <motion.span
            animate={{ flexGrow: e.count }}
            className="h-full min-w-[3px] rounded-full"
            initial={reduced ? false : { flexGrow: 0 }}
            key={`${facet}-${e.label}`}
            style={{ background: timelineProjectColor(e.label) }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
        {rest > 0 && <span className="bg-muted h-full rounded-full" style={{ flexGrow: rest }} />}
      </div>

      <ul className="flex flex-col gap-1">
        {visible.map((e, index) => {
          const isActive = active[facet] === e.label;
          const pct = e.count / total;
          return (
            <motion.li
              animate={{ opacity: 1, x: 0 }}
              initial={reduced ? false : { opacity: 0, x: -6 }}
              key={`${facet}-${e.label}`}
              transition={{ delay: index * 0.04, duration: 0.35 }}
            >
              <button
                aria-pressed={isActive}
                className={cn(
                  'group hover:bg-muted/70 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  isActive && 'bg-muted'
                )}
                onClick={() => onToggle(facet, e.label)}
                type="button"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: timelineProjectColor(e.label) }}
                />
                <span className="min-w-0 flex-1 truncate">{e.label}</span>
                <span className="bg-muted relative hidden h-1 w-16 overflow-hidden rounded-full sm:block">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: timelineProjectColor(e.label), width: `${pct * 100}%` }}
                  />
                </span>
                <span className="text-muted-foreground w-10 text-right font-mono text-xs tabular-nums">
                  {Math.round(pct * 100)}%
                </span>
                <span className="w-12 text-right font-mono text-xs tabular-nums">{e.count}</span>
              </button>
            </motion.li>
          );
        })}
      </ul>
      {entries.length > VISIBLE && (
        <p className="text-muted-foreground text-xs">
          +{entries.length - VISIBLE} more · {rest} heartbeats
        </p>
      )}
    </section>
  );
}
