/*
 * Theme facade: Cinema renders the `overview-insights.native` layout, every other preset the
 * `overview-insights.classic` one (the layout before the theme redesigns).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './overview-insights.classic';
import * as Native from './overview-insights.native';

export { leadingItem } from './overview-insights.native';

export function OverviewInsights() {
  return (
    <LayoutSwitch classic={<Classic.OverviewInsights />} native={<Native.OverviewInsights />} />
  );
}
