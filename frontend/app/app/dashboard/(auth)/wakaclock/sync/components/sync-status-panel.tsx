/*
 * Theme facade: Motion Native renders the `sync-status-panel.native` layout, every other preset the
 * `sync-status-panel.classic` one (the layout before the Motion Native redesign).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './sync-status-panel.classic';
import * as Native from './sync-status-panel.native';

export function SyncStatusPanel() {
  return <LayoutSwitch classic={<Classic.SyncStatusPanel />} native={<Native.SyncStatusPanel />} />;
}
