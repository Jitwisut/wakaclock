/*
 * Theme facade: Cinema renders the `pulse-monitor.native` layout, every other preset the
 * `pulse-monitor.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './pulse-monitor.classic';
import * as Native from './pulse-monitor.native';

export { formatClock } from './pulse-monitor.native';

export function PulseMonitor(
  props: React.ComponentProps<typeof Classic.PulseMonitor> &
    React.ComponentProps<typeof Native.PulseMonitor>
) {
  return (
    <LayoutSwitch
      classic={<Classic.PulseMonitor {...props} />}
      native={<Native.PulseMonitor {...props} />}
    />
  );
}
