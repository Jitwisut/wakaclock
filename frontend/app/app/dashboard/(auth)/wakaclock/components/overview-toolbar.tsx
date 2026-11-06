/*
 * Theme facade: Motion Native renders the `overview-toolbar.native` layout, every other preset the
 * `overview-toolbar.classic` one (the layout before the Motion Native redesign).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './overview-toolbar.classic';
import * as Native from './overview-toolbar.native';

export { OVERVIEW_RANGE_DAYS } from './overview-toolbar.native';

export function OverviewToolbar() {
  return <LayoutSwitch classic={<Classic.OverviewToolbar />} native={<Native.OverviewToolbar />} />;
}
