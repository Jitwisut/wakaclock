import { timelineProjectLabel } from './project-timeline-colors';

import type { ActorType, HeartbeatItem } from './types';

/**
 * Count-only presenters for the raw heartbeat inspector. Nothing here derives
 * time: every aggregate is a number of events (or of lines those events
 * reported). Durations come from the canonical activity timeline, never from
 * summing `active_seconds` on this list.
 */

export interface CountEntry {
  count: number;
  label: string;
}

interface LineTotals {
  added: number;
  deleted: number;
}

export interface HeartbeatSummary {
  aiEvents: number;
  aiLines: LineTotals;
  branches: number;
  categories: CountEntry[];
  editors: CountEntry[];
  files: number;
  firstTime: null | number;
  humanLines: LineTotals;
  languages: CountEntry[];
  lastTime: null | number;
  projects: CountEntry[];
  total: number;
  unattributedLines: LineTotals;
  writes: number;
}

const AI_ACTORS: ReadonlySet<ActorType> = new Set<ActorType>(['ai_inferred', 'ai_verified']);

const UNKNOWN_FACET = 'Unknown';

export function displayEditor(editor?: null | string): string {
  if (editor === 'vscode') return 'VS Code';
  if (editor === 'codex-desktop') return 'Codex Desktop';
  return editor?.trim() || UNKNOWN_FACET;
}

export function facetLabel(value?: null | string): string {
  return value?.trim() || UNKNOWN_FACET;
}

/** Same actor split as the server's actor rollup (`repository/analytics.rs`). */
export function isAiHeartbeat(hb: Pick<HeartbeatItem, 'actor_type'>): boolean {
  return AI_ACTORS.has((hb.actor_type ?? 'unknown') as ActorType);
}

function sortedCounts(counts: Map<string, number>): CountEntry[] {
  return [...counts]
    .map(([label, count]) => ({ count, label }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function bump(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function n(value: null | number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function summarizeHeartbeats(rows: readonly HeartbeatItem[]): HeartbeatSummary {
  const projects = new Map<string, number>();
  const languages = new Map<string, number>();
  const editors = new Map<string, number>();
  const categories = new Map<string, number>();
  const files = new Set<string>();
  const branches = new Set<string>();
  const aiLines = { added: 0, deleted: 0 };
  const humanLines = { added: 0, deleted: 0 };
  const unattributedLines = { added: 0, deleted: 0 };
  let writes = 0;
  let aiEvents = 0;
  let firstTime: null | number = null;
  let lastTime: null | number = null;

  for (const hb of rows) {
    bump(projects, timelineProjectLabel(hb.project));
    bump(languages, facetLabel(hb.language));
    bump(editors, displayEditor(hb.editor));
    bump(categories, facetLabel(hb.category));
    files.add(hb.entity);
    if (hb.branch?.trim()) branches.add(`${timelineProjectLabel(hb.project)}\u0000${hb.branch.trim()}`);
    if (hb.is_write) writes += 1;
    if (firstTime === null || hb.time < firstTime) firstTime = hb.time;
    if (lastTime === null || hb.time > lastTime) lastTime = hb.time;

    const actor = hb.actor_type ?? 'unknown';
    unattributedLines.added += n(hb.unattributed_lines_added);
    unattributedLines.deleted += n(hb.unattributed_lines_deleted);
    if (isAiHeartbeat(hb)) {
      aiEvents += 1;
      aiLines.added += n(hb.ai_lines_added);
      aiLines.deleted += n(hb.ai_lines_deleted);
    } else if (actor === 'human') {
      humanLines.added += n(hb.human_lines_added);
      humanLines.deleted += n(hb.human_lines_deleted);
    } else if (actor === 'unknown') {
      unattributedLines.added += n(hb.ai_lines_added) + n(hb.human_lines_added);
      unattributedLines.deleted += n(hb.ai_lines_deleted) + n(hb.human_lines_deleted);
    }
  }

  return {
    aiEvents,
    aiLines,
    branches: branches.size,
    categories: sortedCounts(categories),
    editors: sortedCounts(editors),
    files: files.size,
    firstTime,
    humanLines,
    languages: sortedCounts(languages),
    lastTime,
    projects: sortedCounts(projects),
    total: rows.length,
    unattributedLines,
    writes,
  };
}

/** Event count per local clock bucket. `bucketMinutes` must divide 1440. */
export function bucketHeartbeatCounts(
  rows: readonly Pick<HeartbeatItem, 'time'>[],
  bucketMinutes: number
): number[] {
  const buckets = Array.from({ length: Math.ceil(1440 / bucketMinutes) }, () => 0);
  for (const hb of rows) {
    const at = new Date(hb.time * 1000);
    const minute = at.getHours() * 60 + at.getMinutes();
    buckets[Math.min(buckets.length - 1, Math.floor(minute / bucketMinutes))] += 1;
  }
  return buckets;
}

export function heartbeatHour(hb: Pick<HeartbeatItem, 'time'>): number {
  return new Date(hb.time * 1000).getHours();
}

export interface HeartbeatFilter {
  aiOnly: boolean;
  editor: null | string;
  hour: null | number;
  language: null | string;
  project: null | string;
  query: string;
  writesOnly: boolean;
}

export const EMPTY_HEARTBEAT_FILTER: HeartbeatFilter = {
  aiOnly: false,
  editor: null,
  hour: null,
  language: null,
  project: null,
  query: '',
  writesOnly: false,
};

export function isFilterActive(filter: HeartbeatFilter): boolean {
  return (
    filter.aiOnly ||
    filter.writesOnly ||
    filter.editor !== null ||
    filter.hour !== null ||
    filter.language !== null ||
    filter.project !== null ||
    filter.query.trim() !== ''
  );
}

export function matchesHeartbeatFilter(hb: HeartbeatItem, filter: HeartbeatFilter): boolean {
  if (filter.writesOnly && !hb.is_write) return false;
  if (filter.aiOnly && !isAiHeartbeat(hb)) return false;
  if (filter.project !== null && timelineProjectLabel(hb.project) !== filter.project) return false;
  if (filter.language !== null && facetLabel(hb.language) !== filter.language) return false;
  if (filter.editor !== null && displayEditor(hb.editor) !== filter.editor) return false;
  if (filter.hour !== null && heartbeatHour(hb) !== filter.hour) return false;
  const query = filter.query.trim().toLowerCase();
  if (query) {
    const haystack = [hb.entity, hb.project, hb.branch, hb.language]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

/** Split a file entity into basename and parent path for two-line display. */
export function splitEntityPath(entity: string): { dir: string; name: string } {
  let end = entity.length;
  while (end > 0 && (entity[end - 1] === '/' || entity[end - 1] === '\\')) end -= 1;
  const trimmed = entity.slice(0, end);
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (index < 0) return { dir: '', name: trimmed || entity };
  return { dir: trimmed.slice(0, index), name: trimmed.slice(index + 1) };
}
