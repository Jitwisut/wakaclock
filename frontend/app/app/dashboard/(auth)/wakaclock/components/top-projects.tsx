/*
 * Theme facade: Motion Native renders the `top-projects.native` layout, every other preset the
 * `top-projects.classic` one (the layout before the Motion Native redesign).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './top-projects.classic';
import * as Native from './top-projects.native';

export { TOP_PROJECTS_LIMIT } from './top-projects.native';

export function TopProjects() {
  return <LayoutSwitch classic={<Classic.TopProjects />} native={<Native.TopProjects />} />;
}
