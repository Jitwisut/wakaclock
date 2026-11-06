import { DashboardPanel } from '@/components/dashboard-panels';
import { CinemaSection } from '@/components/wakaclock/cinema-section';
import { RequireUser } from '@/components/wakaclock/require-user';
import { TimeCore } from '@/components/wakaclock/time-core/time-core';

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
 * Cinema overview, composed as scenes:
 *
 * 01 The day — the Time Core stage, full-bleed under the slate.
 * 02 The range — progress, highlights and projects for the toolbar range, set as an
 *    asymmetric editorial grid rather than a uniform bento.
 * 03 AI & code — attribution analytics.
 * 04 The record — browsing and the session-level timeline.
 *
 * Every panel is still individually switchable from Settings (lib/dashboard-panels.ts);
 * one toolbar range drives every range-based panel.
 */
export default function WakaclockOverviewPage() {
  return (
    <RequireUser>
      <OverviewMotion>
        <h1 className="sr-only">Overview</h1>
        <div className="flex flex-col gap-[clamp(3rem,6vw,5.5rem)]">
          <DashboardPanel id="overview.time-core">
            <TimeCore />
          </DashboardPanel>

          <CinemaSection
            actions={<OverviewToolbar />}
            aside="your time, focus and progress across the range"
            id="overview-range"
            number="02"
            title="The range"
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-12">
              <DashboardPanel id="overview.character-sheet">
                <Reveal className="lg:col-span-7">
                  <CharacterSheetHero />
                </Reveal>
              </DashboardPanel>
              <DashboardPanel id="overview.status-tiles">
                <Reveal className="lg:col-span-5" delay={0.06}>
                  <StatusTiles />
                </Reveal>
              </DashboardPanel>
              <DashboardPanel id="overview.insights">
                <Reveal className="lg:col-span-12">
                  <OverviewInsights />
                </Reveal>
              </DashboardPanel>
              <DashboardPanel id="overview.top-projects">
                <Reveal className="lg:col-span-5">
                  <TopProjects />
                </Reveal>
              </DashboardPanel>
              <DashboardPanel id="overview.range-stats">
                <Reveal className="lg:col-span-7" delay={0.06}>
                  <RangeStats />
                </Reveal>
              </DashboardPanel>
              <DashboardPanel id="overview.summaries">
                <Reveal className="lg:col-span-12">
                  <SummariesPanel />
                </Reveal>
              </DashboardPanel>
            </div>
          </CinemaSection>

          <DashboardPanel id="overview.analytics">
            <CinemaSection
              aside="who wrote the change — measured, inferred or unknown"
              id="overview-ai"
              number="03"
              title="AI & code"
            >
              <Reveal>
                <PhaseNineDashboard />
              </Reveal>
            </CinemaSection>
          </DashboardPanel>

          <CinemaSection
            aside="where the hours went, session by session"
            id="overview-record"
            number="04"
            title="The record"
          >
            <div className="flex flex-col gap-10">
              <DashboardPanel id="overview.duration-timeline">
                <Reveal>
                  <DurationTimeline />
                </Reveal>
              </DashboardPanel>
              <DashboardPanel id="overview.browsing">
                <section aria-label="Browsing" className="flex flex-col gap-3">
                  <h3 className="cinema-label">Browsing</h3>
                  <BrowsingPanel />
                </section>
              </DashboardPanel>
            </div>
          </CinemaSection>
        </div>
      </OverviewMotion>
    </RequireUser>
  );
}
