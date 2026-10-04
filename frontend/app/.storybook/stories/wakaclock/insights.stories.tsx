import type { Meta, StoryObj } from '@storybook/react';
import { DashboardPanelsProvider } from '@/components/dashboard-panels';
import { InsightsReport } from '@/components/wakaclock/insights/insights-workspace';
import styles from '@/components/wakaclock/insights/insights-workspace.module.css';
import { insightsFixture, insightsStatsFixture } from './insights.fixtures';

function Preview({ missing = false }: { missing?: boolean }) {
  return (
    <DashboardPanelsProvider>
      <main className={styles.workspace} style={{ maxWidth: 1280, margin: '0 auto', padding: 28 }}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>PERSONAL ANALYTICS · SAMPLE DATA</span>
            <h1>Insights</h1>
          </div>
        </header>
        <section className={styles.intro}>
          <div>
            <span className={styles.eyebrow}>A LITTLE PERSPECTIVE GOES A LONG WAY</span>
            <h2>
              Your time.
              <br />
              <em>A clearer picture.</em>
            </h2>
            <p>Explore the tools, projects, and habits that shape your work.</p>
          </div>
        </section>
        <InsightsReport
          data={
            missing
              ? {
                  ...insightsFixture,
                  comparable_seconds: undefined,
                  ai_additional_seconds: undefined,
                  ai_measured_seconds: undefined,
                }
              : insightsFixture
          }
          stats={missing ? undefined : insightsStatsFixture}
          statsError={missing}
        />
      </main>
    </DashboardPanelsProvider>
  );
}
const meta = {
  title: 'Wakaclock/Insights',
  component: Preview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
export const MissingMeasurements: Story = { args: { missing: true } };
