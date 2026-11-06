/*
 * Theme facade: Motion Native renders the `duration-timeline.native` layout, every other preset the
 * `duration-timeline.classic` one (the layout before the Motion Native redesign).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './duration-timeline.classic';
import * as Native from './duration-timeline.native';

export function DurationTimeline() {
  return (
    <LayoutSwitch classic={<Classic.DurationTimeline />} native={<Native.DurationTimeline />} />
  );
}
