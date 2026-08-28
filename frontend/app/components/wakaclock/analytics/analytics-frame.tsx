'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';

import { AnalyticsFilterBar } from '@/components/wakaclock/analytics/analytics-filter-bar';
import { AnalyticsNav } from '@/components/wakaclock/analytics/analytics-nav';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useAnalyticsFilters } from '@/hooks/use-analytics-filters';
import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { getAnalyticsExplorer } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export interface AnalyticsFrameContext {
  data: AnalyticsExplorerResponse;
  filters: ReturnType<typeof useAnalyticsFilters>['filters'];
  href: ReturnType<typeof useAnalyticsFilters>['href'];
  setFilter: ReturnType<typeof useAnalyticsFilters>['setFilter'];
  setRange: ReturnType<typeof useAnalyticsFilters>['setRange'];
}

type AnalyticsHrefOverrides = Parameters<ReturnType<typeof useAnalyticsFilters>['href']>[1];

export function AnalyticsFrame({
  children,
  description,
  lockedProjectId,
  title,
}: {
  children: (context: AnalyticsFrameContext) => React.ReactNode;
  description: string;
  lockedProjectId?: string;
  title: string;
}) {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const {
    filters,
    href: buildHref,
    reset,
    setFilter,
    setRange,
    toRequest,
  } = useAnalyticsFilters(30);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const request = toRequest(timezone, lockedProjectId);
  const query = useQuery({
    enabled: Boolean(userId),
    queryFn: () => getAnalyticsExplorer(request),
    queryKey: [
      ...wakaclockKeys.analyticsExplorer(
        userId,
        request.start,
        request.end,
        timezone,
        request.project_id,
        request.language,
        request.editor,
        request.category,
        request.source,
        request.operating_system
      ),
      request,
    ] as const,
  });
  const href = React.useCallback(
    (path: string, overrides: AnalyticsHrefOverrides = {}) =>
      buildHref(path, {
        ...overrides,
        ...(lockedProjectId ? { projectId: lockedProjectId } : {}),
      }),
    [buildHref, lockedProjectId]
  );

  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader description={description} title={title} />
      <RequireUser>
        <div className="space-y-4">
          <AnalyticsNav href={href} />
          <QueryState
            error={query.error}
            isEmpty={false}
            isLoading={query.isLoading}
            skeletonClassName="h-40 w-full"
          >
            {query.data && (
              <>
                <AnalyticsFilterBar
                  filters={filters}
                  lockedProjectId={lockedProjectId}
                  onReset={reset}
                  onSetFilter={setFilter}
                  onSetRange={setRange}
                  options={query.data.filter_options}
                />
                {children({
                  data: query.data,
                  filters,
                  href,
                  setFilter,
                  setRange,
                })}
              </>
            )}
          </QueryState>
        </div>
      </RequireUser>
    </div>
  );
}
