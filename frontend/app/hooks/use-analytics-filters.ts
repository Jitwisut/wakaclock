'use client';

import * as React from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type {
  AnalyticsExplorerParams,
  AnalyticsFilterParamName,
  AnalyticsSourceFilter,
} from '@/lib/wakaclock/analytics';
import { daysAgoDateString, todayDateString } from '@/lib/wakaclock/format';

const SOURCE_VALUES = new Set<AnalyticsSourceFilter>(['human', 'ai', 'other']);

export interface AnalyticsUrlFilters {
  category?: string;
  editor?: string;
  end: string;
  language?: string;
  operatingSystem?: string;
  projectId?: string;
  source?: AnalyticsSourceFilter;
  start: string;
}

function valueOrUndefined(value: null | string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function useAnalyticsFilters(defaultDays = 30) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaults = React.useMemo(
    () => ({ end: todayDateString(), start: daysAgoDateString(defaultDays - 1) }),
    [defaultDays]
  );
  const sourceValue = valueOrUndefined(searchParams.get('source'));
  const source =
    (SOURCE_VALUES.has(sourceValue as AnalyticsSourceFilter) &&
      (sourceValue as AnalyticsSourceFilter)) ||
    undefined;
  const filters = React.useMemo<AnalyticsUrlFilters>(
    () => ({
      category: valueOrUndefined(searchParams.get('category')),
      editor: valueOrUndefined(searchParams.get('editor')),
      end: valueOrUndefined(searchParams.get('end')) ?? defaults.end,
      language: valueOrUndefined(searchParams.get('language')),
      operatingSystem: valueOrUndefined(searchParams.get('operating_system')),
      projectId: valueOrUndefined(searchParams.get('project_id')),
      source,
      start: valueOrUndefined(searchParams.get('start')) ?? defaults.start,
    }),
    [defaults.end, defaults.start, searchParams, source]
  );

  const replaceParams = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setFilter = React.useCallback(
    (name: AnalyticsFilterParamName, value?: string) => {
      replaceParams((params) => {
        if (!value || value === 'all') params.delete(name);
        else params.set(name, value);
      });
    },
    [replaceParams]
  );

  const setRange = React.useCallback(
    (range: { end: string; start: string }) => {
      replaceParams((params) => {
        params.set('start', range.start);
        params.set('end', range.end);
      });
    },
    [replaceParams]
  );

  const reset = React.useCallback(() => {
    replaceParams((params) => {
      params.set('start', defaults.start);
      params.set('end', defaults.end);
      for (const key of [
        'project_id',
        'language',
        'editor',
        'category',
        'source',
        'operating_system',
      ]) {
        params.delete(key);
      }
    });
  }, [defaults.end, defaults.start, replaceParams]);

  const href = React.useCallback(
    (targetPath: string, overrides: Partial<AnalyticsUrlFilters> = {}) => {
      const next = { ...filters, ...overrides };
      const params = new URLSearchParams();
      params.set('start', next.start);
      params.set('end', next.end);
      if (next.projectId) params.set('project_id', next.projectId);
      if (next.language) params.set('language', next.language);
      if (next.editor) params.set('editor', next.editor);
      if (next.category) params.set('category', next.category);
      if (next.source) params.set('source', next.source);
      if (next.operatingSystem) params.set('operating_system', next.operatingSystem);
      return `${targetPath}?${params.toString()}`;
    },
    [filters]
  );

  const toRequest = React.useCallback(
    (timezone: string, fixedProjectId?: string): AnalyticsExplorerParams => ({
      category: filters.category,
      editor: filters.editor,
      end: filters.end,
      language: filters.language,
      operating_system: filters.operatingSystem,
      project_id: fixedProjectId ?? filters.projectId,
      source: filters.source,
      start: filters.start,
      timezone,
    }),
    [filters]
  );

  return { filters, href, reset, setFilter, setRange, toRequest };
}
