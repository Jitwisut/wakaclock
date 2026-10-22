import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';

import { SyncStatusPanel } from './components/sync-status-panel';

export default function WakaclockSyncPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Whether your devices' activity has reached the server, and what is still waiting."
        title="Sync status"
      />
      <RequireUser>
        <SyncStatusPanel />
      </RequireUser>
    </div>
  );
}
