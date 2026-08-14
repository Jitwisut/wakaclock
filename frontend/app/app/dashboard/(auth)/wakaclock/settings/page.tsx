import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';

import { ApiKeyPanel } from './components/api-key-panel';
import { MaintenancePanel } from './components/maintenance-panel';
import { ProjectMergesPanel } from './components/project-merges-panel';
import { ProjectRulesPanel } from './components/project-rules-panel';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Character settings — project rules run at write time, merges at read time; reprocess and import are one-off maintenance jobs."
        title="Settings"
      />
      <RequireUser>
        <Tabs defaultValue="api-key">
          <TabsList>
            <TabsTrigger value="api-key">API key</TabsTrigger>
            <TabsTrigger value="rules">Project rules</TabsTrigger>
            <TabsTrigger value="merges">Project merges</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>
          {/*
            forceMount because a freshly generated key exists only in this panel's
            React state — the server stores nothing but its hash. Radix unmounts
            inactive tab content by default, so switching to any other tab destroyed
            the only copy of the key, silently and unrecoverably. Kept mounted and
            hidden with CSS instead; the other tabs can unmount freely since their
            state is all refetchable.
          */}
          <TabsContent
            className="pt-4 data-[state=inactive]:hidden"
            forceMount
            value="api-key"
          >
            <ApiKeyPanel />
          </TabsContent>
          <TabsContent className="pt-4" value="rules">
            <ProjectRulesPanel />
          </TabsContent>
          <TabsContent className="pt-4" value="merges">
            <ProjectMergesPanel />
          </TabsContent>
          <TabsContent className="pt-4" value="maintenance">
            <MaintenancePanel />
          </TabsContent>
        </Tabs>
      </RequireUser>
    </div>
  );
}
