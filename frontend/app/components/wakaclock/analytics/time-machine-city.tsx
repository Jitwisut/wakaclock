/*
 * Theme facade: Motion Native renders the `time-machine-city.native` layout, every other preset the
 * `time-machine-city.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './time-machine-city.classic';
import * as Native from './time-machine-city.native';

export function CityPlayer(
  props: React.ComponentProps<typeof Classic.CityPlayer> &
    React.ComponentProps<typeof Native.CityPlayer>
) {
  return (
    <LayoutSwitch
      classic={<Classic.CityPlayer {...props} />}
      native={<Native.CityPlayer {...props} />}
    />
  );
}

export function TimeMachineCity(
  props: React.ComponentProps<typeof Classic.TimeMachineCity> &
    React.ComponentProps<typeof Native.TimeMachineCity>
) {
  return (
    <LayoutSwitch
      classic={<Classic.TimeMachineCity {...props} />}
      native={<Native.TimeMachineCity {...props} />}
    />
  );
}
