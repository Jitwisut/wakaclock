import type { ReplayAiSession, ReplayEvent, ReplayEventKind, ReplaySegment } from './analytics';

/** Seconds a whole range takes to play at 1x, whatever its length. */
export const REPLAY_BASE_SECONDS = 60;

export type ReplayActorGroup = 'ai' | 'human' | 'other';
export type ReplayEventTone = 'failure' | 'neutral' | 'success';

const EVENT_LABELS: Record<ReplayEventKind, string> = {
  ci_cancelled: 'CI cancelled',
  ci_failure: 'CI failed',
  ci_success: 'CI passed',
  pr_closed: 'closed',
  pr_first_review: 'first review',
  pr_merged: 'merged',
  pr_opened: 'opened',
  pr_ready: 'ready for review',
};

export interface ReplayRankedItem {
  key: string;
  name: string;
  seconds: number;
}

export interface ReplaySnapshot {
  aiSeconds: number;
  humanSeconds: number;
  languages: ReplayRankedItem[];
  otherSeconds: number;
  projects: ReplayRankedItem[];
  totalSeconds: number;
}

/** Playback skips time with no activity: a position counts worked seconds, not wall time. */
export interface ReplayTimeline {
  offsets: number[];
  segments: ReplaySegment[];
  totalSeconds: number;
}

export function buildReplayTimeline(segments: ReplaySegment[]): ReplayTimeline {
  let totalSeconds = 0;
  const offsets = segments.map((segment) => {
    const offset = totalSeconds;
    totalSeconds += segment.end - segment.start;
    return offset;
  });
  return { offsets, segments, totalSeconds };
}

function segmentIndexAt(timeline: ReplayTimeline, position: number) {
  let low = 0;
  let high = timeline.offsets.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (timeline.offsets[middle] <= position) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function segmentAt(timeline: ReplayTimeline, position: number) {
  return timeline.segments[segmentIndexAt(timeline, position)];
}

export function wallTimeAt(timeline: ReplayTimeline, position: number) {
  const index = segmentIndexAt(timeline, position);
  const segment = timeline.segments[index];
  return Math.min(segment.start + Math.max(position - timeline.offsets[index], 0), segment.end);
}

/** Wall time inside a skipped gap maps to the start of the next worked segment. */
export function positionAtWallTime(timeline: ReplayTimeline, wallTime: number) {
  for (const [index, segment] of timeline.segments.entries()) {
    if (wallTime < segment.end) {
      return timeline.offsets[index] + Math.max(wallTime - segment.start, 0);
    }
  }
  return timeline.totalSeconds;
}

export function actorGroup(actorType: ReplaySegment['actor_type']): ReplayActorGroup {
  if (actorType === 'human') return 'human';
  return actorType === 'unknown' ? 'other' : 'ai';
}

function addSeconds(
  totals: Map<string, ReplayRankedItem>,
  key: string,
  name: string,
  seconds: number
) {
  const existing = totals.get(key);
  if (existing) existing.seconds += seconds;
  else totals.set(key, { key, name, seconds });
}

function ranked(totals: Map<string, ReplayRankedItem>) {
  return [...totals.values()].sort((left, right) => right.seconds - left.seconds);
}

/** Cumulative worked time up to `position`, so the last frame equals the response summary. */
export function snapshotAt(timeline: ReplayTimeline, position: number): ReplaySnapshot {
  const projects = new Map<string, ReplayRankedItem>();
  const languages = new Map<string, ReplayRankedItem>();
  const actors = { ai: 0, human: 0, other: 0 };

  for (const [index, segment] of timeline.segments.entries()) {
    const offset = timeline.offsets[index];
    if (offset >= position) break;
    const seconds = Math.min(segment.end - segment.start, position - offset);
    actors[actorGroup(segment.actor_type)] += seconds;
    addSeconds(
      projects,
      segment.project_id ?? segment.project ?? 'unknown',
      segment.project ?? 'Unknown',
      seconds
    );
    addSeconds(languages, segment.language ?? 'Unknown', segment.language ?? 'Unknown', seconds);
  }

  return {
    aiSeconds: actors.ai,
    humanSeconds: actors.human,
    languages: ranked(languages),
    otherSeconds: actors.other,
    projects: ranked(projects),
    totalSeconds: actors.ai + actors.human + actors.other,
  };
}

/** Dominant actor per column, so a large range never renders one element per segment. */
export function buildActivityTrack(timeline: ReplayTimeline, columns: number) {
  const width = timeline.totalSeconds / columns;
  const track: Array<{ column: number; group: ReplayActorGroup }> = [];
  let index = 0;

  for (let column = 0; column < columns; column += 1) {
    const columnStart = column * width;
    const columnEnd = columnStart + width;
    const seconds = { ai: 0, human: 0, other: 0 };
    let cursor = index;
    while (cursor < timeline.segments.length && timeline.offsets[cursor] < columnEnd) {
      const segment = timeline.segments[cursor];
      const start = timeline.offsets[cursor];
      const end = start + segment.end - segment.start;
      seconds[actorGroup(segment.actor_type)] +=
        Math.min(end, columnEnd) - Math.max(start, columnStart);
      if (end > columnEnd) break;
      cursor += 1;
    }
    index = cursor;
    const group = (Object.keys(seconds) as ReplayActorGroup[]).reduce((best, candidate) =>
      seconds[candidate] > seconds[best] ? candidate : best
    );
    track.push({ column, group });
  }
  return track;
}

export function aiSessionBands(timeline: ReplayTimeline, sessions: ReplayAiSession[]) {
  return sessions.map((session, id) => {
    const start = positionAtWallTime(timeline, session.start);
    const end = positionAtWallTime(timeline, session.end);
    return {
      agent: session.agent,
      id,
      leftPercent: (start * 100) / timeline.totalSeconds,
      widthPercent: ((end - start) * 100) / timeline.totalSeconds,
    };
  });
}

export function activeAgentsAt(sessions: ReplayAiSession[], wallTime: number) {
  const active = sessions.filter((session) => session.start <= wallTime && wallTime < session.end);
  return [...new Set(active.map((session) => session.agent))];
}

export function replayEventLabel(event: ReplayEvent) {
  return `PR #${event.number} ${EVENT_LABELS[event.kind]}`;
}

export function replayEventTone(kind: ReplayEventKind): ReplayEventTone {
  if (kind === 'ci_failure') return 'failure';
  return kind === 'ci_success' || kind === 'pr_merged' ? 'success' : 'neutral';
}

/** A repository is the only dimension an event has, so only a project filter can apply. */
export function eventsForProject(events: ReplayEvent[], projectId?: string) {
  if (!projectId) return events;
  return events.filter((event) => event.project_ids.includes(projectId));
}

/** An event in a skipped gap, such as a merge overnight, lands on the next worked moment. */
export function replayEventMarkers(timeline: ReplayTimeline, events: ReplayEvent[]) {
  return events.map((event) => {
    const position = positionAtWallTime(timeline, event.at);
    return { event, leftPercent: (position * 100) / timeline.totalSeconds, position };
  });
}

export function latestEventAt(events: ReplayEvent[], wallTime: number) {
  let latest: ReplayEvent | undefined;
  for (const event of events) {
    if (event.at <= wallTime) latest = event;
  }
  return latest;
}

export function nextPosition(
  position: number,
  elapsedMs: number,
  speed: number,
  totalSeconds: number
) {
  const perMillisecond = (totalSeconds * speed) / (REPLAY_BASE_SECONDS * 1000);
  return Math.min(position + elapsedMs * perMillisecond, totalSeconds);
}

export function formatReplayMoment(epochSeconds: number, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: timezone,
    weekday: 'short',
  }).format(new Date(epochSeconds * 1000));
}
