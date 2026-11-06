/*
 * Theme facade: Cinema renders the `top-projects.native` layout, every other preset the
 * `top-projects.classic` one (the layout before the theme redesigns).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './top-projects.classic';
import * as Native from './top-projects.native';

export { TOP_PROJECTS_LIMIT } from './top-projects.native';

export function TopProjects() {
  return <LayoutSwitch classic={<Classic.TopProjects />} native={<Native.TopProjects />} />;
}
