/*
 * Theme facade: Motion Native renders the `agent-universe.native` layout, every other preset the
 * `agent-universe.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './agent-universe.classic';
import * as Native from './agent-universe.native';

export { AgentUniverseRange } from './agent-universe.native';
export type { LiveView } from './agent-universe.native';

export function UniversePlayer(
  props: React.ComponentProps<typeof Classic.UniversePlayer> &
    React.ComponentProps<typeof Native.UniversePlayer>
) {
  return (
    <LayoutSwitch
      classic={<Classic.UniversePlayer {...props} />}
      native={<Native.UniversePlayer {...props} />}
    />
  );
}

export function AgentUniversePanel() {
  return (
    <LayoutSwitch classic={<Classic.AgentUniversePanel />} native={<Native.AgentUniversePanel />} />
  );
}
