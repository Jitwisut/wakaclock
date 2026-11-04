/*
 * Theme facade: Motion Native renders the `summaries-panel.native` layout, every other preset the
 * `summaries-panel.classic` one (the layout before the Motion Native redesign).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './summaries-panel.classic';
import * as Native from './summaries-panel.native';

export function SummariesPanel() {
  return <LayoutSwitch classic={<Classic.SummariesPanel />} native={<Native.SummariesPanel />} />;
}
