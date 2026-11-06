/*
 * Theme facade: Cinema renders the `attribution-timeline.native` layout, every other preset the
 * `attribution-timeline.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './attribution-timeline.classic';
import * as Native from './attribution-timeline.native';

export {
  formatMeasure,
  formatShare,
  formatTime,
  granularityLabel,
  timelineRows,
} from './attribution-timeline.native';

export function AttributionTimeline(
  props: React.ComponentProps<typeof Classic.AttributionTimeline> &
    React.ComponentProps<typeof Native.AttributionTimeline>
) {
  return (
    <LayoutSwitch
      classic={<Classic.AttributionTimeline {...props} />}
      native={<Native.AttributionTimeline {...props} />}
    />
  );
}
