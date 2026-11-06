/*
 * Theme facade: Cinema renders the `attribution-mix-list.native` layout, every other preset the
 * `attribution-mix-list.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './attribution-mix-list.classic';
import * as Native from './attribution-mix-list.native';

export function AttributionMixList(
  props: React.ComponentProps<typeof Classic.AttributionMixList> &
    React.ComponentProps<typeof Native.AttributionMixList>
) {
  return (
    <LayoutSwitch
      classic={<Classic.AttributionMixList {...props} />}
      native={<Native.AttributionMixList {...props} />}
    />
  );
}
