/*
 * Theme facade: Motion Native renders the `page-header.native` layout, every other preset the
 * `page-header.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './page-header.classic';
import * as Native from './page-header.native';

export function WakaclockPageHeader(
  props: React.ComponentProps<typeof Classic.WakaclockPageHeader> &
    React.ComponentProps<typeof Native.WakaclockPageHeader>
) {
  return (
    <LayoutSwitch
      classic={<Classic.WakaclockPageHeader {...props} />}
      native={<Native.WakaclockPageHeader {...props} />}
    />
  );
}
