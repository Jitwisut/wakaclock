'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';

import { AnalyticsFilterBar } from '@/components/wakaclock/analytics/analytics-filter-bar.native';
import { AnalyticsNav } from '@/components/wakaclock/analytics/analytics-nav';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { InspectorLayout } from '@/components/wakaclock/workspace';
import { useAnalyticsFilters } from '@/hooks/use-analytics-filters';
import type { AnalyticsExplorerParams, AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { getAnalyticsExplorer } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export interface AnalyticsFrameContext {
  data: AnalyticsExplorerResponse;
  filters: ReturnType<typeof useAnalyticsFilters>['filters'];
  href: ReturnType<typeof useAnalyticsFilters>['href'];
  /** The explorer request behind `data`, for views that issue related queries. */
  request: AnalyticsExplorerParams;
  setFilter: ReturnType<typeof useAnalyticsFilters>['setFilter'];
  setRange: ReturnType<typeof useAnalyticsFilters>['setRange'];
  userId: string;
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
  // The hook owns the URL/browser fallback. Reuse the selected value for both the
  // request and query key so changing timezone cannot retain another range's cache.
  const { timezone } = filters;
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
        request.operating_system,
        request.actor_type
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

  const activeFilters = [
    lockedProjectId ? undefined : filters.projectId,
    filters.language,
    filters.editor,
    filters.category,
    filters.source,
    filters.actorType,
    filters.operatingSystem,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      <WakaclockPageHeader
        actions={
          <RangePicker onChange={setRange} value={{ start: filters.start, end: filters.end }} />
        }
        description={description}
        title={title}
      >
        <AnalyticsNav href={href} />
      </WakaclockPageHeader>
      <RequireUser>
        <QueryState
          error={query.error}
          isEmpty={false}
          isLoading={query.isLoading}
          skeletonClassName="h-40 w-full"
        >
          {query.data && (
            <InspectorLayout
              activeCount={activeFilters}
              inspector={
                <AnalyticsFilterBar
                  filters={filters}
                  lockedProjectId={lockedProjectId}
                  onReset={reset}
                  onSetFilter={setFilter}
                  options={query.data.filter_options}
                />
              }
              inspectorDescription="Every view on this page follows these filters."
              inspectorTitle="Filters"
            >
              {children({
                data: query.data,
                filters,
                href,
                request,
                setFilter,
                setRange,
                userId,
              })}
            </InspectorLayout>
          )}
        </QueryState>
      </RequireUser>
    </div>
  );
}
