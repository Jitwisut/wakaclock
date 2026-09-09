import { ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

import { DashboardPanel } from '@/components/dashboard-panels';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';

import { CharacterSheetHero } from './components/character-sheet-hero';
import { DurationTimeline } from './components/duration-timeline';
import { PhaseNineDashboard } from './components/phase-nine-dashboard';
import { RangeStats } from './components/range-stats';
import { StatusTiles } from './components/status-tiles';
import { SummariesPanel } from './components/summaries-panel';
import { TopProjects } from './components/top-projects';
import styles from './overview.module.css';

export default function WakaclockOverviewPage() {
  return (
    <div className={styles.overview}>
      <WakaclockPageHeader
        actions={
          <Link className={styles.customize} href="/dashboard/wakaclock/settings">
            <SlidersHorizontal aria-hidden size={15} /> Customize{' '}
            <ArrowUpRight aria-hidden size={14} />
          </Link>
        }
        description="A clearer view of your time, focus, and progress."
        title="Player dashboard"
      />
      <RequireUser>
        {/* Each panel is individually switchable from Settings; see lib/dashboard-panels.ts. */}
        <div className="flex flex-col gap-4">
          <DashboardPanel id="overview.character-sheet">
            <CharacterSheetHero />
          </DashboardPanel>
          <DashboardPanel id="overview.status-tiles">
            <StatusTiles />
          </DashboardPanel>
          <DashboardPanel id="overview.analytics">
            <PhaseNineDashboard />
          </DashboardPanel>
          <DashboardPanel id="overview.range-stats">
            <RangeStats />
          </DashboardPanel>
          <DashboardPanel id="overview.top-projects">
            <TopProjects />
          </DashboardPanel>
          <DashboardPanel id="overview.summaries">
            <SummariesPanel />
          </DashboardPanel>
          <DashboardPanel id="overview.duration-timeline">
            <DurationTimeline />
          </DashboardPanel>
        </div>
      </RequireUser>
    </div>
  );
}
