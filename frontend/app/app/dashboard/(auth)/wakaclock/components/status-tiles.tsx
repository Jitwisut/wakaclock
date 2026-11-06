/*
 * Theme facade: Cinema renders the `status-tiles.native` layout, every other preset the
 * `status-tiles.classic` one (the layout before the theme redesigns).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './status-tiles.classic';
import * as Native from './status-tiles.native';

export function StatusTiles() {
  return <LayoutSwitch classic={<Classic.StatusTiles />} native={<Native.StatusTiles />} />;
}
