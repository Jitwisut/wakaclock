/*
 * Theme facade: Motion Native renders the `status-tiles.native` layout, every other preset the
 * `status-tiles.classic` one (the layout before the Motion Native redesign).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './status-tiles.classic';
import * as Native from './status-tiles.native';

export function StatusTiles() {
  return <LayoutSwitch classic={<Classic.StatusTiles />} native={<Native.StatusTiles />} />;
}
