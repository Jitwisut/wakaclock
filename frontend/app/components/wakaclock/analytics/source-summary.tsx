/*
 * Theme facade: Cinema renders the `source-summary.native` layout, every other preset the
 * `source-summary.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './source-summary.classic';
import * as Native from './source-summary.native';

export function SourceSummary(
  props: React.ComponentProps<typeof Classic.SourceSummary> &
    React.ComponentProps<typeof Native.SourceSummary>
) {
  return (
    <LayoutSwitch
      classic={<Classic.SourceSummary {...props} />}
      native={<Native.SourceSummary {...props} />}
    />
  );
}
