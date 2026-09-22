import {
  FolderSyncIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  RegexIcon,
  WrenchIcon,
} from 'lucide-react';

export type SettingsSectionId = 'api-key' | 'maintenance' | 'merges' | 'panels' | 'rules';

export interface SettingsSection {
  description: string;
  hint: string;
  icon: LucideIcon;
  id: SettingsSectionId;
  label: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    description:
      'Lets a CLI, editor extension or agent hook authenticate as you. Always tied to the account this session is logged into.',
    hint: 'Connect your tools',
    icon: KeyRoundIcon,
    id: 'api-key',
    label: 'API key',
  },
  {
    description:
      'Regex rules run at write time and override the client-supplied project on every ingested heartbeat.',
    hint: 'Rename at write time',
    icon: RegexIcon,
    id: 'rules',
    label: 'Project rules',
  },
  {
    description:
      'Merges run at read time and fold one project into another — on the Projects page only.',
    hint: 'Fold at read time',
    icon: FolderSyncIcon,
    id: 'merges',
    label: 'Project merges',
  },
  {
    description: 'Choose which panels and charts the dashboard draws on this device.',
    hint: 'Tune the dashboard',
    icon: LayoutDashboardIcon,
    id: 'panels',
    label: 'Panels',
  },
  {
    description: 'Reprocess and import are one-off maintenance jobs.',
    hint: 'One-off jobs',
    icon: WrenchIcon,
    id: 'maintenance',
    label: 'Maintenance',
  },
];

export function isSettingsSection(value: null | string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}
