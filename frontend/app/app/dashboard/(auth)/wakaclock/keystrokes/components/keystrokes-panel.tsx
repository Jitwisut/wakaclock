/*
 * Theme facade: Cinema renders the `keystrokes-panel.native` layout, every other preset the
 * `keystrokes-panel.classic` one (the layout before the theme redesigns).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './keystrokes-panel.classic';
import * as Native from './keystrokes-panel.native';

export function KeystrokesPanel() {
  return <LayoutSwitch classic={<Classic.KeystrokesPanel />} native={<Native.KeystrokesPanel />} />;
}
