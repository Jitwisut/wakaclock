/*
 * Theme facade: Cinema renders the `analytics-nav.native` layout, every other preset the
 * `analytics-nav.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './analytics-nav.classic';
import * as Native from './analytics-nav.native';

export function AnalyticsNav(
  props: React.ComponentProps<typeof Classic.AnalyticsNav> &
    React.ComponentProps<typeof Native.AnalyticsNav>
) {
  return (
    <LayoutSwitch
      classic={<Classic.AnalyticsNav {...props} />}
      native={<Native.AnalyticsNav {...props} />}
    />
  );
}
