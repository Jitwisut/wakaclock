'use client';

import { SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

import { RangePicker } from '@/components/wakaclock/range-picker';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';

/** Default window for every range-driven panel on the overview. */
export const OVERVIEW_RANGE_DAYS = 30;

/**
 * The overview's single range control. Insights, Projects, Daily summaries and Analytics
 * all read the same `?start=&end=` through `useWakaclockRange(OVERVIEW_RANGE_DAYS)`, so
 * one picker drives them together instead of three pickers silently fighting over the
 * same URL params with different defaults. Stats keeps its own preset tabs and the
 * session timeline its own day, and the hint says so.
 */
export function OverviewToolbar() {
  const { start, end, setRange } = useWakaclockRange(OVERVIEW_RANGE_DAYS);

  return (
    <section
      aria-label="Overview range"
      className="flex flex-wrap items-center gap-2"
      title="Range for highlights, projects, daily trend and analytics"
    >
      <RangePicker onChange={setRange} value={{ start, end }} />
      <Link
        className="bg-card hover:bg-accent inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors"
        href="/dashboard/wakaclock/settings"
      >
        <SlidersHorizontal aria-hidden size={14} /> Customize
      </Link>
    </section>
  );
}
