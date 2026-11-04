/*
 * Theme facade: Motion Native renders the `project-deep-dive.native` layout, every other preset the
 * `project-deep-dive.classic` one (the layout before the Motion Native redesign).
 */

import type * as React from 'react';

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './project-deep-dive.classic';
import * as Native from './project-deep-dive.native';

export function ProjectAiPanel(
  props: React.ComponentProps<typeof Classic.ProjectAiPanel> &
    React.ComponentProps<typeof Native.ProjectAiPanel>
) {
  return (
    <LayoutSwitch
      classic={<Classic.ProjectAiPanel {...props} />}
      native={<Native.ProjectAiPanel {...props} />}
    />
  );
}

export function ProjectFilesPanel(
  props: React.ComponentProps<typeof Classic.ProjectFilesPanel> &
    React.ComponentProps<typeof Native.ProjectFilesPanel>
) {
  return (
    <LayoutSwitch
      classic={<Classic.ProjectFilesPanel {...props} />}
      native={<Native.ProjectFilesPanel {...props} />}
    />
  );
}

export function ProjectDeepDive(
  props: React.ComponentProps<typeof Classic.ProjectDeepDive> &
    React.ComponentProps<typeof Native.ProjectDeepDive>
) {
  return (
    <LayoutSwitch
      classic={<Classic.ProjectDeepDive {...props} />}
      native={<Native.ProjectDeepDive {...props} />}
    />
  );
}
