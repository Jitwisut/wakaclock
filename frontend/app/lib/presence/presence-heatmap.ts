/**
 * Team co-working rhythm: when an organization's teams share co-working sessions,
 * bucketed by local weekday and hour. Mirrors `PresenceHeatmapData` in
 * `backend/api/src/handlers/presence_v2.rs`. Aggregate only: the server suppresses the
 * whole grid until three people have shared sessions, and blanks any slot built from a
 * single session.
 */
export interface PresenceHeatmapData {
  /** Seven rows, Monday first, of 24 hourly totals in seconds. */
  cells: null | number[][];
  /** Slots blanked because only one session fell into them. */
  hidden_slots: number;
  peak: { hour: number; seconds: number; weekday: number } | null;
  session_count: null | number;
  suppressed: boolean;
  timezone: string;
  total_seconds: null | number;
  truncated: boolean;
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_NAMES = [
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
  'Sundays',
] as const;

/** 0 (none) to 4 (busiest), relative to the busiest cell, so the scale fits any team size. */
export function intensityLevel(seconds: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0 || max <= 0) return 0;
  const ratio = seconds / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** "Tuesdays, 14:00–15:00" for the busiest cell, or null when nothing was shared. */
export function peakLabel(peak: PresenceHeatmapData['peak']): null | string {
  if (!peak) return null;
  return `${WEEKDAY_NAMES[peak.weekday]}, ${hourLabel(peak.hour)}–${hourLabel((peak.hour + 1) % 24)}`;
}

/** The busiest cell's value, used as the top of the colour scale. */
export function maxCell(cells: number[][]): number {
  return cells.reduce((max, row) => Math.max(max, ...row), 0);
}
