/*
 * Theme facade: Cinema renders the `page.native` layout, every other preset the
 * `page.classic` one (the layout before the theme redesigns).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './page.classic';
import * as Native from './page.native';

export default function GoalsPage() {
  return <LayoutSwitch classic={<Classic.default />} native={<Native.default />} />;
}
