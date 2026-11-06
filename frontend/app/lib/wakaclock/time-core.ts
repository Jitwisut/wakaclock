import {
  isUnassignedTimelineProject,
  timelineProjectColor,
} from '@/lib/wakaclock/project-timeline-colors';
import { buildTimelineSessions } from '@/lib/wakaclock/timeline-sessions';
import type { DurationsResponse } from '@/lib/wakaclock/types';

/*
 * The Time Core: one day of canonical durations arranged as a 24-hour dial. Each project
 * is a concentric ring; each grouped session is an arc on that ring at the hour it
 * happened. Pure data — the 3D scene, the 2D fallback and the accessible list all render
 * from this one model, so they can never disagree.
 *
 * Every second here comes from GET /durations (the canonical activity timeline). Nothing
 * is inferred from raw heartbeats and nothing is added between metrics that overlap.
 */

export const TIME_CORE_MAX_RINGS = 6;
export const OTHER_PROJECTS_LABEL = 'Other projects';
const DAY_SECONDS = 24 * 3600;
const TAU = Math.PI * 2;

export type TimeCoreArc = {
  /** Seconds of recorded activity inside the arc (union of intervals, not the span). */
  durationSeconds: number;
  /** Epoch seconds. */
  end: number;
  /** Radians clockwise from midnight (top of the dial). */
  endAngle: number;
  id: string;
  /** The project as recorded (rings merged into "Other projects" keep their own name). */
  project: string;
  /** Epoch seconds. */
  start: number;
  startAngle: number;
};

export type TimeCoreRing = {
  arcs: TimeCoreArc[];
  /** Hex colour for WebGL; CSS colour for the DOM. */
  color: string;
  cssColor: string;
  label: string;
  totalSeconds: number;
};

export type TimeCoreAttribution = {
  aiOnlySeconds: number;
  humanOnlySeconds: number;
  overlapSeconds: number;
};

export type TimeCoreModel = {
  /** Measured human/AI split, only when the server says the day is fully measured. */
  attribution: null | TimeCoreAttribution;
  /** Activity outside any project: counted in the total, drawn on no ring. */
  hiddenSeconds: number;
  /** Measured active seconds, when the server reports them. Never added to the total. */
  measuredActiveSeconds: null | number;
  rangeEnd: number;
  rangeStart: number;
  rings: TimeCoreRing[];
  sessionCount: number;
  /**
   * Activity with timeout: `wakatime_compatible_seconds`, else `total_seconds`, else the sum
   * of every duration block (unassigned included). Matches the Sessions panel.
   */
  totalSeconds: number;
};

/** sRGB hex from a CSS `oklch(L% C H)` string; WebGL colours cannot read OKLCH. */
export function oklchToHex(css: string): string {
  const match = /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/i.exec(css);
  if (!match) return '#8a939e';
  const rawL = Number(match[1]);
  const l = css.includes('%') && rawL > 1 ? rawL / 100 : rawL;
  const c = Number(match[2]);
  const h = (Number(match[3]) * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const lCube = (l + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const mCube = (l - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const sCube = (l - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;

  const linear = [
    4.076_741_662_1 * lCube - 3.307_711_591_3 * mCube + 0.230_969_929_2 * sCube,
    -1.268_438_004_6 * lCube + 2.609_757_401_1 * mCube - 0.341_319_396_5 * sCube,
    -0.004_196_086_3 * lCube - 0.703_418_614_7 * mCube + 1.707_614_701 * sCube,
  ];
  return `#${linear
    .map((value) => {
      const clamped = Math.min(1, Math.max(0, value));
      const srgb = clamped <= 0.003_130_8 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
      return Math.round(srgb * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

function angleAt(epochSeconds: number, rangeStart: number, rangeSeconds: number) {
  const offset = Math.min(rangeSeconds, Math.max(0, epochSeconds - rangeStart));
  return (offset / rangeSeconds) * TAU;
}

/** Midnight of the browser's local day for `date` (yyyy-MM-dd), as epoch seconds. */
function localMidnight(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getTime() / 1000;
}

export function buildTimeCore(data: DurationsResponse): TimeCoreModel {
  const blocks = data.data ?? [];
  const rangeStart =
    typeof data.range_start === 'number' ? data.range_start : localMidnight(data.date);
  const rangeEnd =
    typeof data.range_end === 'number' && data.range_end > rangeStart
      ? data.range_end
      : rangeStart + DAY_SECONDS;
  const rangeSeconds = rangeEnd - rangeStart;

  const blockSeconds = blocks.reduce((sum, block) => sum + block.duration_seconds, 0);
  // The headline is the same "Activity with timeout" figure the Sessions panel shows
  // (owner approval 2026-11-07); the block sum is the fallback when the server omits it.
  const totalSeconds = data.wakatime_compatible_seconds ?? data.total_seconds ?? blockSeconds;
  const visible = blocks.filter((block) => !isUnassignedTimelineProject(block.project));
  const hiddenSeconds = blockSeconds - visible.reduce((sum, b) => sum + b.duration_seconds, 0);
  const sessions = buildTimelineSessions(visible);

  const byProject = new Map<string, TimeCoreArc[]>();
  sessions.forEach((session, index) => {
    const arcs = byProject.get(session.project) ?? [];
    arcs.push({
      durationSeconds: session.duration_seconds,
      end: session.end,
      endAngle: angleAt(session.end, rangeStart, rangeSeconds),
      id: `${session.project}-${index}`,
      project: session.project,
      start: session.start,
      startAngle: angleAt(session.start, rangeStart, rangeSeconds),
    });
    byProject.set(session.project, arcs);
  });

  const ranked = [...byProject.entries()]
    .map(([label, arcs]) => ({
      arcs,
      label,
      totalSeconds: arcs.reduce((sum, arc) => sum + arc.durationSeconds, 0),
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds || a.label.localeCompare(b.label));

  const kept = ranked.slice(0, TIME_CORE_MAX_RINGS - (ranked.length > TIME_CORE_MAX_RINGS ? 1 : 0));
  const merged = ranked.slice(kept.length);
  const rings: TimeCoreRing[] = kept.map((ring) => {
    const cssColor = timelineProjectColor(ring.label);
    return { ...ring, color: oklchToHex(cssColor), cssColor };
  });
  if (merged.length > 0) {
    const cssColor = 'oklch(66% 0.02 245)';
    rings.push({
      arcs: merged.flatMap((ring) => ring.arcs).sort((a, b) => a.start - b.start),
      color: oklchToHex(cssColor),
      cssColor,
      label: OTHER_PROJECTS_LABEL,
      totalSeconds: merged.reduce((sum, ring) => sum + ring.totalSeconds, 0),
    });
  }

  const measured = data.active_coverage === 'measured';
  const attribution =
    measured &&
    data.active_human_only_seconds != null &&
    data.active_ai_only_seconds != null &&
    data.active_overlap_seconds != null
      ? {
          aiOnlySeconds: data.active_ai_only_seconds,
          humanOnlySeconds: data.active_human_only_seconds,
          overlapSeconds: data.active_overlap_seconds,
        }
      : null;

  return {
    attribution,
    hiddenSeconds: Math.max(0, hiddenSeconds),
    measuredActiveSeconds: data.active_seconds ?? null,
    rangeEnd,
    rangeStart,
    rings,
    sessionCount: sessions.length,
    totalSeconds,
  };
}
