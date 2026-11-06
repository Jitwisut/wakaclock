/*
 * Theme facade: Motion Native renders the `requires-postgres.native` layout, every other preset the
 * `requires-postgres.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './requires-postgres.classic';
import * as Native from './requires-postgres.native';

export function RequiresPostgres(
  props: React.ComponentProps<typeof Classic.RequiresPostgres> &
    React.ComponentProps<typeof Native.RequiresPostgres>
) {
  return (
    <LayoutSwitch
      classic={<Classic.RequiresPostgres {...props} />}
      native={<Native.RequiresPostgres {...props} />}
    />
  );
}
