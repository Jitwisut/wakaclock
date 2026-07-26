'use client';

import * as React from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { daysAgoDateString, todayDateString } from '@/lib/wakaclock/format';

export interface WakaclockRange {
  end: string;
  start: string;
}

/**
 * Shared start/end date-range state, persisted in the URL (?start=&end=) so
 * links to a specific range are shareable. Defaults to the last 7 days.
 */
export function useWakaclockRange(defaultDays = 7) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const start = searchParams.get('start') ?? daysAgoDateString(defaultDays - 1);
  const end = searchParams.get('end') ?? todayDateString();

  const setRange = React.useCallback(
    (range: WakaclockRange) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('start', range.start);
      params.set('end', range.end);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return { start, end, setRange };
}
