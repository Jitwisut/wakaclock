'use client';

import * as React from 'react';

import { DiffIcon, FilesIcon, FolderGit2Icon, PencilLineIcon, SparklesIcon } from 'lucide-react';
import { motion } from 'motion/react';

import { CountAnimation } from '@/components/ui/custom/count-animation';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';
import type { HeartbeatSummary } from '@/lib/wakaclock/heartbeat-stats';
import { timelineProjectColor } from '@/lib/wakaclock/project-timeline-colors';

import styles from '../heartbeats.module.css';

const AI_TONE = 'oklch(0.66 0.2 295)';
const HUMAN_TONE = 'oklch(0.7 0.14 175)';
const UNATTRIBUTED_TONE = 'oklch(0.7 0.02 255)';

function share(part: number, whole: number) {
  return whole > 0 ? part / whole : 0;
}

function percent(part: number, whole: number) {
  return `${Math.round(share(part, whole) * 100)}%`;
}

function Tile({
  children,
  className,
  icon,
  index,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
  label: string;
}) {
  const reduced = useReducedMotion();
  const Icon = icon;
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        styles.tile,
        'bg-card text-card-foreground flex min-w-0 flex-col gap-3 rounded-2xl border p-4 shadow-xs sm:p-5',
        className
      )}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`);
      }}
      transition={{ delay: 0.08 * index, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <Icon className="size-3.5" />
        {label}
      </div>
      {children}
    </motion.div>
  );
}

function Figure({ value }: { value: number }) {
  return (
    <div className="text-3xl font-semibold tracking-tight tabular-nums">
      <CountAnimation duration={0.9} value={value} />
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg aria-hidden="true" className="size-11 -rotate-90" viewBox="0 0 40 40">
      <circle className="stroke-muted" cx="20" cy="20" fill="none" r={r} strokeWidth="4" />
      <motion.circle
        animate={{ strokeDashoffset: c * (1 - value) }}
        cx="20"
        cy="20"
        fill="none"
        initial={reduced ? false : { strokeDashoffset: c }}
        r={r}
        stroke="oklch(0.78 0.15 75)"
        strokeDasharray={c}
        strokeLinecap="round"
        strokeWidth="4"
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

function formatLines(value: number) {
  return value.toLocaleString();
}

export function StatTiles({ summary }: { summary: HeartbeatSummary }) {
  const reduced = useReducedMotion();
  const writeShare = share(summary.writes, summary.total);
  const lineSegments = [
    { label: 'AI', lines: summary.aiLines, tone: AI_TONE },
    { label: 'Human', lines: summary.humanLines, tone: HUMAN_TONE },
    { label: 'Unattributed', lines: summary.unattributedLines, tone: UNATTRIBUTED_TONE },
  ];
  const changed = lineSegments.reduce((sum, s) => sum + s.lines.added + s.lines.deleted, 0);
  const added = lineSegments.reduce((sum, s) => sum + s.lines.added, 0);
  const deleted = lineSegments.reduce((sum, s) => sum + s.lines.deleted, 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
      <Tile icon={PencilLineIcon} index={0} label="Writes">
        <div className="flex items-end justify-between gap-2">
          <Figure value={summary.writes} />
          <Ring value={writeShare} />
        </div>
        <p className="text-muted-foreground text-xs">
          {percent(summary.writes, summary.total)} of heartbeats saved a file
        </p>
      </Tile>

      <Tile icon={FilesIcon} index={1} label="Files touched">
        <Figure value={summary.files} />
        <p className="text-muted-foreground text-xs">
          on {summary.branches} branch{summary.branches === 1 ? '' : 'es'}
        </p>
      </Tile>

      <Tile icon={FolderGit2Icon} index={2} label="Projects">
        <Figure value={summary.projects.length} />
        <div aria-hidden="true" className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          {summary.projects.slice(0, 8).map((p) => (
            <span
              className="h-full rounded-full"
              key={p.label}
              style={{
                background: timelineProjectColor(p.label),
                flexGrow: p.count,
              }}
            />
          ))}
        </div>
        <p className="text-muted-foreground truncate text-xs">
          {summary.projects[0] ? `Most active: ${summary.projects[0].label}` : 'No projects yet'}
        </p>
      </Tile>

      <Tile icon={SparklesIcon} index={3} label="AI heartbeats">
        <Figure value={summary.aiEvents} />
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <motion.div
            animate={{ scaleX: share(summary.aiEvents, summary.total) }}
            className="h-full origin-left rounded-full"
            initial={reduced ? false : { scaleX: 0 }}
            style={{ background: AI_TONE }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {percent(summary.aiEvents, summary.total)} verified or inferred AI
        </p>
      </Tile>

      <Tile className="col-span-2" icon={DiffIcon} index={4} label="Lines reported">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-3xl font-semibold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
            +{formatLines(added)}
          </span>
          <span className="text-xl font-semibold tracking-tight text-rose-600 tabular-nums dark:text-rose-400">
            −{formatLines(deleted)}
          </span>
        </div>
        <div
          aria-hidden="true"
          className="bg-muted flex h-2 gap-0.5 overflow-hidden rounded-full"
        >
          {changed > 0 &&
            lineSegments.map((s) => (
              <motion.span
                animate={{ opacity: 1 }}
                className="h-full"
                initial={reduced ? false : { opacity: 0 }}
                key={s.label}
                style={{ background: s.tone, flexGrow: s.lines.added + s.lines.deleted }}
                transition={{ duration: 0.8 }}
              />
            ))}
        </div>
        <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {lineSegments.map((s) => (
            <li className="flex items-center gap-1.5" key={s.label}>
              <span className="size-2 rounded-full" style={{ background: s.tone }} />
              {s.label}
              <span className="text-foreground font-mono tabular-nums">
                +{formatLines(s.lines.added)} −{formatLines(s.lines.deleted)}
              </span>
            </li>
          ))}
        </ul>
      </Tile>
    </div>
  );
}
