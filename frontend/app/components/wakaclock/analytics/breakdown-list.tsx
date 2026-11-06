/*
 * Theme facade: Cinema renders the `breakdown-list.native` layout, every other preset the
 * `breakdown-list.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './breakdown-list.classic';
import * as Native from './breakdown-list.native';

export function BreakdownList(
  props: React.ComponentProps<typeof Classic.BreakdownList> &
    React.ComponentProps<typeof Native.BreakdownList>
) {
  return (
    <LayoutSwitch
      classic={<Classic.BreakdownList {...props} />}
      native={<Native.BreakdownList {...props} />}
    />
  );
}
