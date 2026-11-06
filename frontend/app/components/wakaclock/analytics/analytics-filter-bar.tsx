/*
 * Theme facade: Cinema renders the `analytics-filter-bar.native` layout, every other preset the
 * `analytics-filter-bar.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './analytics-filter-bar.classic';
import * as Native from './analytics-filter-bar.native';

export function AnalyticsFilterBar(
  props: React.ComponentProps<typeof Classic.AnalyticsFilterBar> &
    React.ComponentProps<typeof Native.AnalyticsFilterBar>
) {
  return (
    <LayoutSwitch
      classic={<Classic.AnalyticsFilterBar {...props} />}
      native={<Native.AnalyticsFilterBar {...props} />}
    />
  );
}
