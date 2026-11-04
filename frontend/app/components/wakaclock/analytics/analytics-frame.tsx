/*
 * Theme facade: Motion Native renders the `analytics-frame.native` layout, every other preset the
 * `analytics-frame.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './analytics-frame.classic';
import * as Native from './analytics-frame.native';

export type { AnalyticsFrameContext } from './analytics-frame.native';

export function AnalyticsFrame(
  props: React.ComponentProps<typeof Classic.AnalyticsFrame> &
    React.ComponentProps<typeof Native.AnalyticsFrame>
) {
  return (
    <LayoutSwitch
      classic={<Classic.AnalyticsFrame {...props} />}
      native={<Native.AnalyticsFrame {...props} />}
    />
  );
}
