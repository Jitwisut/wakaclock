import { describe, expect, it } from 'vitest';

import {
  presentAttributionDataCoverage,
  presentCodeAttribution,
  presentPeriodComparison,
} from '@/lib/wakaclock/dashboard-analytics-presenters';
import type { DashboardAnalyticsResponse } from '@/lib/wakaclock/types';

function coverage(
  overrides: Partial<DashboardAnalyticsResponse['coverage']> = {}
): DashboardAnalyticsResponse['coverage'] {
  return {
    attribution_data_coverage_percent: 100,
    attribution_percent: 90,
    attribution_relevant_rows: 10,
    attribution_status: 'complete',
    attributed_changes: 90,
    cost_percent: null,
    incomplete_attribution_rows: 0,
    token_percent: null,
    unattributed_changes: 10,
    ...overrides,
  };
}

describe('presentPeriodComparison', () => {
  it('renders zero-to-positive activity as human copy without a fake percentage or enum', () => {
    const result = presentPeriodComparison(
      {
        current_seconds: 3_600,
        direction: 'new_activity',
        percent: null,
        previous_seconds: 0,
      },
      30
    );

    expect(result.label).toBe('Change vs previous 30 days');
    expect(result.value).toBe('New activity');
    expect(result.subtext).toBe('Previous 0s → Current 1h');
    expect(result.value).not.toContain('new_activity');
    expect(result.value).not.toContain('—%');
  });

  it('adds a sign only to positive percentage changes', () => {
    expect(
      presentPeriodComparison(
        { current_seconds: 150, direction: 'increase', percent: 50, previous_seconds: 100 },
        7
      ).value
    ).toBe('+50.0%');
    expect(
      presentPeriodComparison(
        { current_seconds: 50, direction: 'decrease', percent: -50, previous_seconds: 100 },
        7
      ).value
    ).toBe('-50.0%');
  });
});

describe('attribution coverage presenters', () => {
  it('separates code attribution from metadata coverage', () => {
    const value = coverage({
      attribution_data_coverage_percent: 80,
      attribution_status: 'partial',
      incomplete_attribution_rows: 2,
    });

    expect(presentCodeAttribution(value)).toEqual({
      label: 'Code attribution',
      subtext: '90 of 100 measured changes attributed · partial metadata',
      value: '90.0%',
    });
    expect(presentAttributionDataCoverage(value)).toEqual({
      label: 'Attribution data coverage',
      subtext: '2 of 10 code-change records lack complete attribution metadata.',
      value: '80.0%',
    });
  });

  it('reports no activity instead of an unavailable percentage', () => {
    const value = coverage({
      attribution_data_coverage_percent: null,
      attribution_percent: null,
      attribution_relevant_rows: 0,
      attribution_status: 'no_activity',
      attributed_changes: 0,
      unattributed_changes: 0,
    });

    expect(presentCodeAttribution(value).value).toBe('No code changes');
    expect(presentAttributionDataCoverage(value).value).toBe('No code changes');
  });
});

it('keeps unavailable ratios distinct from measured zero with complete and partial coverage', () => {
  expect(
    presentPeriodComparison(
      { current_seconds: 60, previous_seconds: 30, direction: 'increase', percent: null },
      1
    )
  ).toMatchObject({ label: 'Change vs previous 1 day', value: 'Unavailable' });
  expect(
    presentPeriodComparison(
      { current_seconds: 30, previous_seconds: 30, direction: 'unchanged', percent: 0 },
      1
    ).value
  ).toBe('No change');
  const missing = coverage({ attribution_percent: null, attribution_data_coverage_percent: null });
  expect(presentCodeAttribution(missing).value).toBe('Unavailable');
  expect(presentAttributionDataCoverage(missing).value).toBe('Unavailable');
  const measured = coverage({ attribution_percent: 0, attribution_data_coverage_percent: 0 });
  expect(presentCodeAttribution(measured).value).toBe('0.0%');
  expect(presentAttributionDataCoverage(measured)).toMatchObject({
    value: '0.0%',
    subtext: 'All code-change records include attribution metadata.',
  });
});
