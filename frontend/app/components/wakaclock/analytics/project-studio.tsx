/*
 * Theme facade: Motion Native renders the `project-studio.native` layout, every other preset the
 * `project-studio.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './project-studio.classic';
import * as Native from './project-studio.native';

export { studioColors } from './project-studio.native';

export function ProjectStudio(
  props: React.ComponentProps<typeof Classic.ProjectStudio> &
    React.ComponentProps<typeof Native.ProjectStudio>
) {
  return (
    <LayoutSwitch
      classic={<Classic.ProjectStudio {...props} />}
      native={<Native.ProjectStudio {...props} />}
    />
  );
}

export function StudioBreakdown(
  props: React.ComponentProps<typeof Classic.StudioBreakdown> &
    React.ComponentProps<typeof Native.StudioBreakdown>
) {
  return (
    <LayoutSwitch
      classic={<Classic.StudioBreakdown {...props} />}
      native={<Native.StudioBreakdown {...props} />}
    />
  );
}

export function ProjectRhythm(
  props: React.ComponentProps<typeof Classic.ProjectRhythm> &
    React.ComponentProps<typeof Native.ProjectRhythm>
) {
  return (
    <LayoutSwitch
      classic={<Classic.ProjectRhythm {...props} />}
      native={<Native.ProjectRhythm {...props} />}
    />
  );
}
