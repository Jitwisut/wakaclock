import { DashboardPanel } from '@/components/dashboard-panels';
import { DeliveryStatusNotice } from '@/components/wakaclock/delivery-status-notice';
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
import styles from './overview.module.css';

/**
 * Reading order, most glanceable first: today → lifetime → highlights for the range →
 * stats and projects side by side → the daily trend → AI/code analytics → today's
 * session-level detail. One toolbar range drives every range-based panel.
 */
export default function WakaclockOverviewPage() {
  return (
    <div className={styles.overview}>
      <WakaclockPageHeader
        description="Your time, focus and progress at a glance."
        title="Player dashboard"
      />
      <RequireUser>
        <DeliveryStatusNotice />
        <OverviewMotion>
          <div className="flex flex-col gap-8">
            {/* Each panel is individually switchable from Settings; see lib/dashboard-panels.ts. */}
            <DashboardPanel id="overview.character-sheet">
              <Reveal>
                <CharacterSheetHero />
              </Reveal>
            </DashboardPanel>

            <DashboardPanel id="overview.status-tiles">
              <Reveal delay={0.08}>
                <StatusTiles />
              </Reveal>
            </DashboardPanel>

            <OverviewToolbar />

            <DashboardPanel id="overview.insights">
              <Reveal className={styles.section}>
                <h2 className={styles.sectionLabel}>Highlights</h2>
                <OverviewInsights />
              </Reveal>
            </DashboardPanel>

            <section className={styles.section}>
              <h2 className={styles.sectionLabel}>Activity</h2>
              <div className={styles.split}>
                <DashboardPanel id="overview.range-stats">
                  <Reveal>
                    <RangeStats />
                  </Reveal>
                </DashboardPanel>
                <DashboardPanel id="overview.top-projects">
                  <Reveal delay={0.08}>
                    <TopProjects />
                  </Reveal>
                </DashboardPanel>
              </div>
              <DashboardPanel id="overview.summaries">
                <Reveal>
                  <SummariesPanel />
                </Reveal>
              </DashboardPanel>
            </section>

            <DashboardPanel id="overview.browsing">
              <section className={styles.section}>
                <h2 className={styles.sectionLabel}>Browsing</h2>
                <BrowsingPanel />
              </section>
            </DashboardPanel>

            <DashboardPanel id="overview.analytics">
              <Reveal className={styles.section}>
                <h2 className={styles.sectionLabel}>AI &amp; code</h2>
                <PhaseNineDashboard />
              </Reveal>
            </DashboardPanel>

            <DashboardPanel id="overview.duration-timeline">
              <Reveal className={`${styles.section} ${styles.timeline}`}>
                <h2 className={styles.sectionLabel}>Sessions</h2>
                <DurationTimeline />
              </Reveal>
            </DashboardPanel>
          </div>
        </OverviewMotion>
      </RequireUser>
    </div>
  );
}
