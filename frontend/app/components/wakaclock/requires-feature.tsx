/*
 * Theme facade: Cinema renders the `requires-feature.native` layout, every other preset the
 * `requires-feature.classic` one (the layout before the theme redesigns).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './requires-feature.classic';
import * as Native from './requires-feature.native';

export function RequiresFeature(
  props: React.ComponentProps<typeof Classic.RequiresFeature> &
    React.ComponentProps<typeof Native.RequiresFeature>
) {
  return (
    <LayoutSwitch
      classic={<Classic.RequiresFeature {...props} />}
      native={<Native.RequiresFeature {...props} />}
    />
  );
}
