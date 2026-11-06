/*
 * Theme facade: Motion Native renders the `activity-heatmaps.native` layout, every other preset the
 * `activity-heatmaps.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './activity-heatmaps.classic';
import * as Native from './activity-heatmaps.native';

export {
  buildCalendarWeeks,
  buildLatestWeek,
  buildMonthlyActivity,
} from './activity-heatmaps.native';
export type { MonthlyActivityPoint, WeeklyActivityPoint } from './activity-heatmaps.native';

export function ActivityHeatmapBoard(
  props: React.ComponentProps<typeof Classic.ActivityHeatmapBoard> &
    React.ComponentProps<typeof Native.ActivityHeatmapBoard>
) {
  return (
    <LayoutSwitch
      classic={<Classic.ActivityHeatmapBoard {...props} />}
      native={<Native.ActivityHeatmapBoard {...props} />}
    />
  );
}

export function CalendarHeatmap(
  props: React.ComponentProps<typeof Classic.CalendarHeatmap> &
    React.ComponentProps<typeof Native.CalendarHeatmap>
) {
  return (
    <LayoutSwitch
      classic={<Classic.CalendarHeatmap {...props} />}
      native={<Native.CalendarHeatmap {...props} />}
    />
  );
}
