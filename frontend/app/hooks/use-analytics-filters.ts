'use client';

import * as React from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type {
  AnalyticsActorTypeFilter,
  AnalyticsExplorerParams,
  AnalyticsFilterParamName,
  AnalyticsSourceFilter,
} from '@/lib/wakaclock/analytics';
import { daysAgoDateString, todayDateString } from '@/lib/wakaclock/format';
import type { ActorType } from '@/lib/wakaclock/types';

const SOURCE_VALUES = new Set<AnalyticsSourceFilter>(['human', 'ai', 'other']);
const ACTOR_TYPE_VALUES = new Set<ActorType>(['human', 'ai_verified', 'ai_inferred', 'unknown']);

export interface AnalyticsUrlFilters {
  actorType?: AnalyticsActorTypeFilter;
  category?: string;
  editor?: string;
  end: string;
  language?: string;
  operatingSystem?: string;
  projectId?: string;
  source?: AnalyticsSourceFilter;
  start: string;
  timezone: string;
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
  const browserTimezone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);
  const timezoneParam = valueOrUndefined(searchParams.get('timezone'));
  const timezone = timezoneParam ?? browserTimezone;
  const sourceValue = valueOrUndefined(searchParams.get('source'));
  const source =
    (SOURCE_VALUES.has(sourceValue as AnalyticsSourceFilter) &&
      (sourceValue as AnalyticsSourceFilter)) ||
    undefined;
  const actorTypeValue = valueOrUndefined(searchParams.get('actor_type'));
  const actorType =
    (ACTOR_TYPE_VALUES.has(actorTypeValue as ActorType) &&
      (actorTypeValue as AnalyticsActorTypeFilter)) ||
    undefined;
  const filters = React.useMemo<AnalyticsUrlFilters>(
    () => ({
      actorType,
      category: valueOrUndefined(searchParams.get('category')),
      editor: valueOrUndefined(searchParams.get('editor')),
      end: valueOrUndefined(searchParams.get('end')) ?? defaults.end,
      language: valueOrUndefined(searchParams.get('language')),
      operatingSystem: valueOrUndefined(searchParams.get('operating_system')),
      projectId: valueOrUndefined(searchParams.get('project_id')),
      source,
      start: valueOrUndefined(searchParams.get('start')) ?? defaults.start,
      timezone,
    }),
    [actorType, defaults.end, defaults.start, searchParams, source, timezone]
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
        'actor_type',
        'operating_system',
        'timezone',
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
      if (next.actorType) params.set('actor_type', next.actorType);
      if (next.operatingSystem) params.set('operating_system', next.operatingSystem);
      if (next.timezone) params.set('timezone', next.timezone);
      return `${targetPath}?${params.toString()}`;
    },
    [filters]
  );

  const toRequest = React.useCallback(
    // Retain the legacy argument; filters already resolve missing/blank zones to UTC.
    (_fallbackTimezone: string, fixedProjectId?: string): AnalyticsExplorerParams => ({
      category: filters.category,
      actor_type: filters.actorType,
      editor: filters.editor,
      end: filters.end,
      language: filters.language,
      operating_system: filters.operatingSystem,
      project_id: fixedProjectId ?? filters.projectId,
      source: filters.source,
      start: filters.start,
      timezone: filters.timezone,
    }),
    [filters]
  );

  return { filters, href, reset, setFilter, setRange, toRequest };
}
