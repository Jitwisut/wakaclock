/*
 * Theme facade: Motion Native renders the `stat-tile.native` layout, every other preset the
 * `stat-tile.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './stat-tile.classic';
import * as Native from './stat-tile.native';

export function StatTile(
  props: React.ComponentProps<typeof Classic.StatTile> &
    React.ComponentProps<typeof Native.StatTile>
) {
  return (
    <LayoutSwitch
      classic={<Classic.StatTile {...props} />}
      native={<Native.StatTile {...props} />}
    />
  );
}
