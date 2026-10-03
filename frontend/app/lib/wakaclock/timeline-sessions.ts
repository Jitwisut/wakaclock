import { timelineProjectLabel } from '@/lib/wakaclock/project-timeline-colors';
import type { DurationBlock } from '@/lib/wakaclock/types';

export interface TimelineSession {
  categories: string[];
  duration_seconds: number;
  end: number;
  heartbeat_count: number;
  languages: string[];
  project: string;
  start: number;
}

// Presentation grouping only; gaps never contribute to recorded duration.
export const TIMELINE_SESSION_GAP_SECONDS = 5 * 60;

/** Group nearby activity independently for every project, including brief project
 * switches. Longer breaks remain separate; duration is the union of recorded
 * intervals rather than the wall-clock span of the grouped session.
 */
export function buildTimelineSessions(blocks: readonly DurationBlock[]): TimelineSession[] {
  const sessions: TimelineSession[] = [];
  const latest = new Map<string, TimelineSession>();

  for (const block of [...blocks].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const project = timelineProjectLabel(block.project);
    const previous = latest.get(project);
    if (previous && block.start - previous.end <= TIMELINE_SESSION_GAP_SECONDS) {
      previous.duration_seconds += Math.max(0, block.end - Math.max(block.start, previous.end));
      previous.end = Math.max(previous.end, block.end);
      previous.heartbeat_count += block.heartbeat_count;
      if (block.language && !previous.languages.includes(block.language)) {
        previous.languages.push(block.language);
      }
      if (!previous.categories.includes(block.category)) {
        previous.categories.push(block.category);
      }
    } else {
      const session: TimelineSession = {
        project,
        start: block.start,
        end: block.end,
        duration_seconds: block.duration_seconds,
        heartbeat_count: block.heartbeat_count,
        languages: block.language ? [block.language] : [],
        categories: [block.category],
      };
      sessions.push(session);
      latest.set(project, session);
    }
  }

  return sessions;
}
