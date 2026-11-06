/*
 * Theme facade: Cinema renders the `insights-workspace.native` layout, every other preset the
 * `insights-workspace.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './insights-workspace.classic';
import * as Native from './insights-workspace.native';

export function InsightsWorkspace() {
  return (
    <LayoutSwitch classic={<Classic.InsightsWorkspace />} native={<Native.InsightsWorkspace />} />
  );
}

export function InsightsReport(
  props: React.ComponentProps<typeof Classic.InsightsReport> &
    React.ComponentProps<typeof Native.InsightsReport>
) {
  return (
    <LayoutSwitch
      classic={<Classic.InsightsReport {...props} />}
      native={<Native.InsightsReport {...props} />}
    />
  );
}
