import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';

import { ApiKeyPanel } from './components/api-key-panel';
import { DashboardPanelsPanel } from './components/dashboard-panels-panel';
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
            <TabsTrigger value="panels">Panels</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>
          {/* Keep the API-key panel mounted so a freshly generated value remains visible
              while switching tabs; it is also reloaded from the session-only API on mount. */}
          <TabsContent className="pt-4 data-[state=inactive]:hidden" forceMount value="api-key">
            <ApiKeyPanel />
          </TabsContent>
          <TabsContent className="pt-4" value="rules">
            <ProjectRulesPanel />
          </TabsContent>
          <TabsContent className="pt-4" value="merges">
            <ProjectMergesPanel />
          </TabsContent>
          <TabsContent className="pt-4" value="panels">
            <DashboardPanelsPanel />
          </TabsContent>
          <TabsContent className="pt-4" value="maintenance">
            <MaintenancePanel />
          </TabsContent>
        </Tabs>
      </RequireUser>
    </div>
  );
}
