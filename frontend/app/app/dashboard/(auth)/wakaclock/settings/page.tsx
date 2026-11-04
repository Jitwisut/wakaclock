'use client';

import * as React from 'react';

import { RequireUser } from '@/components/wakaclock/require-user';
import { type SettingsGroup, SettingsShell } from '@/components/wakaclock/settings-shell';

import { ApiKeyPanel } from './components/api-key-panel';
import { DashboardPanelsPanel } from './components/dashboard-panels-panel';
import { MaintenancePanel } from './components/maintenance-panel';
import { ProjectMergesPanel } from './components/project-merges-panel';
import { ProjectRulesPanel } from './components/project-rules-panel';
import {
  isSettingsSection,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from './components/sections';

const PANELS: Record<Exclude<SettingsSectionId, 'api-key'>, React.ComponentType> = {
  maintenance: MaintenancePanel,
  merges: ProjectMergesPanel,
  panels: DashboardPanelsPanel,
  rules: ProjectRulesPanel,
};

const GROUP_OF: Record<SettingsSectionId, { id: string; label: string }> = {
  'api-key': { id: 'account', label: 'Account' },
  rules: { id: 'projects', label: 'Projects' },
  merges: { id: 'projects', label: 'Projects' },
  panels: { id: 'dashboard', label: 'Dashboard' },
  maintenance: { id: 'data', label: 'Data' },
};

const GROUPS: SettingsGroup[] = SETTINGS_SECTIONS.reduce<SettingsGroup[]>((groups, section) => {
  const group = GROUP_OF[section.id];
  const item = {
    description: section.description,
    id: section.id,
    keywords: [section.hint],
    label: section.label,
  };
  const existing = groups.find((g) => g.id === group.id);
  if (existing) existing.items.push(item);
  else groups.push({ id: group.id, items: [item], label: group.label });
  return groups;
}, []);

/**
 * The open section lives in `?tab=` so a section is linkable; without it a phone opens
 * on the section list. It is read after mount so the server and first paint agree.
 */
function useSectionParam(): [null | SettingsSectionId, (id: null | SettingsSectionId) => void] {
  const [section, setSection] = React.useState<null | SettingsSectionId>(null);

  React.useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (isSettingsSection(fromUrl)) setSection(fromUrl);
  }, []);

  const change = React.useCallback((id: null | SettingsSectionId) => {
    setSection(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('tab', id);
    else url.searchParams.delete('tab');
    window.history.replaceState(window.history.state, '', url);
  }, []);

  return [section, change];
}

function SettingsWorkspace() {
  const [requested, setSection] = useSectionParam();
  const section: SettingsSectionId = requested ?? 'api-key';
  const current = SETTINGS_SECTIONS.find((s) => s.id === section) ?? SETTINGS_SECTIONS[0];
  const Panel = section === 'api-key' ? null : PANELS[section];

  return (
    <SettingsShell
      activeId={section}
      description={current.description}
      groups={GROUPS}
      onBack={() => setSection(null)}
      onSelect={(id) => isSettingsSection(id) && setSection(id)}
      title={current.label}
      view={requested ? 'detail' : 'list'}
      windowTitle="Settings"
    >
      {/* Kept mounted so a freshly generated key survives a visit to another section. */}
      <div hidden={section !== 'api-key'}>
        <ApiKeyPanel />
      </div>
      {Panel && <Panel key={section} />}
    </SettingsShell>
  );
}

export default function SettingsPage() {
  return (
    <RequireUser>
      <SettingsWorkspace />
    </RequireUser>
  );
}
