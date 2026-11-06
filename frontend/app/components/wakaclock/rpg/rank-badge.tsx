/*
 * Theme facade: Motion Native renders the `rank-badge.native` layout, every other preset the
 * `rank-badge.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './rank-badge.classic';
import * as Native from './rank-badge.native';

export function RankBadge(
  props: React.ComponentProps<typeof Classic.RankBadge> &
    React.ComponentProps<typeof Native.RankBadge>
) {
  return (
    <LayoutSwitch
      classic={<Classic.RankBadge {...props} />}
      native={<Native.RankBadge {...props} />}
    />
  );
}
