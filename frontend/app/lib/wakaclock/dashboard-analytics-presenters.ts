import { formatDurationShort } from './format';

import type { DashboardAnalyticsResponse, PeriodComparison } from './types';

export interface MetricPresentation {
  label: string;
  subtext: string;
  value: string;
}

export function presentPeriodComparison(
  comparison: PeriodComparison,
  daysIncluded: number
): MetricPresentation {
  const dayLabel = daysIncluded === 1 ? 'day' : 'days';
  const label = `Change vs previous ${daysIncluded} ${dayLabel}`;
  const subtext = `Previous ${formatDurationShort(comparison.previous_seconds)} → Current ${formatDurationShort(comparison.current_seconds)}`;

  if (comparison.direction === 'new_activity') {
    return { label, subtext, value: 'New activity' };
  }
  if (comparison.direction === 'unchanged') {
    return { label, subtext, value: 'No change' };
  }
  if (comparison.percent === null) {
    return { label, subtext, value: 'Unavailable' };
  }

  const sign = comparison.percent > 0 ? '+' : '';
  return { label, subtext, value: `${sign}${comparison.percent.toFixed(1)}%` };
}

export function presentCodeAttribution(
  coverage: DashboardAnalyticsResponse['coverage']
): MetricPresentation {
  if (coverage.attribution_status === 'no_activity') {
    return {
      label: 'Code attribution',
      subtext: 'No measured code changes in this range.',
      value: 'No code changes',
    };
  }

  const measuredChanges = coverage.attributed_changes + coverage.unattributed_changes;
  const value =
    coverage.attribution_percent === null
      ? 'Unavailable'
      : `${coverage.attribution_percent.toFixed(1)}%`;
  const partialSuffix = coverage.attribution_status === 'partial' ? ' · partial metadata' : '';

  return {
    label: 'Code attribution',
    subtext: `${coverage.attributed_changes.toLocaleString()} of ${measuredChanges.toLocaleString()} measured changes attributed${partialSuffix}`,
    value,
  };
}

export function presentAttributionDataCoverage(
  coverage: DashboardAnalyticsResponse['coverage']
): MetricPresentation {
  if (coverage.attribution_status === 'no_activity') {
    return {
      label: 'Attribution data coverage',
      subtext: 'No code-change attribution metadata was needed in this range.',
      value: 'No code changes',
    };
  }

  const value =
    coverage.attribution_data_coverage_percent === null
      ? 'Unavailable'
      : `${coverage.attribution_data_coverage_percent.toFixed(1)}%`;
  const subtext =
    coverage.incomplete_attribution_rows === 0
      ? 'All code-change records include attribution metadata.'
      : `${coverage.incomplete_attribution_rows.toLocaleString()} of ${coverage.attribution_relevant_rows.toLocaleString()} code-change records lack complete attribution metadata.`;

  return { label: 'Attribution data coverage', subtext, value };
}
