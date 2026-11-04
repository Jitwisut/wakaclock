import { DashboardPanel } from '@/components/dashboard-panels';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';

import { BrowsingPanel } from './components/browsing-panel';
import { CharacterSheetHero } from './components/character-sheet-hero';
import { DurationTimeline } from './components/duration-timeline';
import { OverviewInsights } from './components/overview-insights';
import { OverviewMotion, Reveal } from './components/overview-motion';
import { OverviewToolbar } from './components/overview-toolbar';
import { PhaseNineDashboard } from './components/phase-nine-dashboard';
import { RangeStats } from './components/range-stats';
import { StatusTiles } from './components/status-tiles';
import { SummariesPanel } from './components/summaries-panel';
import { TopProjects } from './components/top-projects';

/**
 * Reading order, most glanceable first: today → lifetime → highlights for the range →
 * stats and projects side by side → the daily trend → AI/code analytics → today's
 * session-level detail. One toolbar range drives every range-based panel.
 */
export default function WakaclockOverviewPage() {
  return (
    <div className="flex flex-col gap-5">
      <WakaclockPageHeader
        actions={<OverviewToolbar />}
        description="Your time, focus and progress at a glance."
        title="Overview"
      />
      <RequireUser>
        <OverviewMotion>
          {/*
            A bento grid: each panel is a cell sized to its content, today first. Every
            panel stays individually switchable from Settings (lib/dashboard-panels.ts).
          */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <DashboardPanel id="overview.character-sheet">
              <Reveal className="lg:col-span-8">
                <CharacterSheetHero />
              </Reveal>
            </DashboardPanel>

            <DashboardPanel id="overview.status-tiles">
              <Reveal className="lg:col-span-4" delay={0.06}>
                <StatusTiles />
              </Reveal>
            </DashboardPanel>

            <DashboardPanel id="overview.insights">
              <Reveal className="lg:col-span-12">
                <OverviewInsights />
              </Reveal>
            </DashboardPanel>

            <DashboardPanel id="overview.range-stats">
              <Reveal className="lg:col-span-7">
                <RangeStats />
              </Reveal>
            </DashboardPanel>
            <DashboardPanel id="overview.top-projects">
              <Reveal className="lg:col-span-5" delay={0.06}>
                <TopProjects />
              </Reveal>
            </DashboardPanel>

            <DashboardPanel id="overview.summaries">
              <Reveal className="lg:col-span-12">
                <SummariesPanel />
              </Reveal>
            </DashboardPanel>

            <DashboardPanel id="overview.analytics">
              <Reveal className="flex flex-col gap-3 lg:col-span-12">
                <h2 className="text-sm font-semibold tracking-tight">AI &amp; code</h2>
                <PhaseNineDashboard />
              </Reveal>
            </DashboardPanel>

            <DashboardPanel id="overview.browsing">
              <section className="flex flex-col gap-3 lg:col-span-12">
                <h2 className="text-sm font-semibold tracking-tight">Browsing</h2>
                <BrowsingPanel />
              </section>
            </DashboardPanel>

            <DashboardPanel id="overview.duration-timeline">
              <Reveal className="flex flex-col gap-3 lg:col-span-12">
                <h2 className="text-sm font-semibold tracking-tight">Sessions</h2>
                <DurationTimeline />
              </Reveal>
            </DashboardPanel>
          </div>
        </OverviewMotion>
      </RequireUser>
    </div>
  );
}
