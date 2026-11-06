/*
 * Theme facade: Cinema renders the `attribution-overview.native` layout, every other preset the
 * `attribution-overview.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './attribution-overview.classic';
import * as Native from './attribution-overview.native';

export function AttributionOverview(
  props: React.ComponentProps<typeof Classic.AttributionOverview> &
    React.ComponentProps<typeof Native.AttributionOverview>
) {
  return (
    <LayoutSwitch
      classic={<Classic.AttributionOverview {...props} />}
      native={<Native.AttributionOverview {...props} />}
    />
  );
}
