import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';

import { DurationTimeline } from './components/duration-timeline';
import { RangeStats } from './components/range-stats';
import { StatusTiles } from './components/status-tiles';
import { SummariesPanel } from './components/summaries-panel';

export default function WakaclockOverviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Coding-time analytics, backed by the wakaclock Rust API."
        title="Overview"
      />
      <RequireUser>
        <div className="flex flex-col gap-4">
          <StatusTiles />
          <RangeStats />
          <SummariesPanel />
          <DurationTimeline />
        </div>
      </RequireUser>
    </div>
  );
}
