/*
 * Theme facade: Motion Native renders the `time-machine.native` layout, every other preset the
 * `time-machine.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './time-machine.classic';
import * as Native from './time-machine.native';

export function TimeMachinePlayer(
  props: React.ComponentProps<typeof Classic.TimeMachinePlayer> &
    React.ComponentProps<typeof Native.TimeMachinePlayer>
) {
  return (
    <LayoutSwitch
      classic={<Classic.TimeMachinePlayer {...props} />}
      native={<Native.TimeMachinePlayer {...props} />}
    />
  );
}

export function TimeMachinePanel() {
  return (
    <LayoutSwitch classic={<Classic.TimeMachinePanel />} native={<Native.TimeMachinePanel />} />
  );
}
