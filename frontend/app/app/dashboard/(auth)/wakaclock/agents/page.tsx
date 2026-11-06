/*
 * Theme facade: Motion Native renders the `page.native` layout, every other preset the
 * `page.classic` one (the layout before the Motion Native redesign).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './page.classic';
import * as Native from './page.native';

export default function AgentUniversePage() {
  return <LayoutSwitch classic={<Classic.default />} native={<Native.default />} />;
}
