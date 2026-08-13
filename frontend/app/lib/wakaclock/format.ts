import { format } from 'date-fns';

/** Matches backend's `"{h}h {m}m"` / `"{m}m"` (see status_bar.rs::format_duration). */
export function formatSeconds(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Chart-axis and label formatter for durations.
 *
 * Unlike `formatSeconds`, this keeps a seconds tier: a short session renders as "36s"
 * rather than collapsing to "0m", and charts never fall back to raw decimal hours like
 * "0.0025h", which is unreadable at a glance and was how these axes used to render.
 */
export function formatDurationShort(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));

  if (total < 60) {
    return `${total}s`;
  }

  const minutes = Math.floor(total / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** durations.start/end are epoch seconds (f64), not ISO strings. */
export function formatEpochTime(epochSeconds: number): string {
  return format(new Date(epochSeconds * 1000), 'HH:mm');
}

export function formatEpochRange(startSeconds: number, endSeconds: number): string {
  return `${formatEpochTime(startSeconds)}–${formatEpochTime(endSeconds)}`;
}

/** project_rules/project_merges timestamps are ClickHouse DateTime epoch seconds (u32). */
export function formatUnixSeconds(unixSeconds: number): string {
  return format(new Date(unixSeconds * 1000), 'MMM d, yyyy HH:mm');
}

export function todayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function daysAgoDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return format(d, 'yyyy-MM-dd');
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  );
}
