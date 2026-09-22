import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { ActivityTimelineChart } from '@/components/wakaclock/analytics/activity-timeline-chart';
import {
  ProjectAiPanel,
  ProjectFilesPanel,
} from '@/components/wakaclock/analytics/project-deep-dive';
import {
  ProjectRhythm,
  ProjectStudio,
  StudioBreakdown,
} from '@/components/wakaclock/analytics/project-studio';
import styles from '@/components/wakaclock/analytics/project-studio.module.css';

import { aiFixture, fileFixtures, split, studioFixture } from './project-studio.fixtures';

function Preview({ empty = false }: { empty?: boolean }) {
  const [language, setLanguage] = useState('');
  const [editor, setEditor] = useState('');
  const data = empty
    ? {
        ...studioFixture,
        summary: { ...split(0), active_days: 0, ai_share_percent: null },
        calendar_heatmap: [],
        time_heatmap: [],
        breakdowns: { ...studioFixture.breakdowns, languages: [], editors: [] },
      }
    : studioFixture;
  return (
    <main className={`${styles.board} mx-auto max-w-[1400px] p-6`}>
      <p className="text-muted-foreground text-xs">Project Studio · Sample data preview</p>
      <ProjectStudio data={data} name="wakaclock" />
      <div className={styles.timelineGrid}>
        <ActivityTimelineChart data={data} />
        <ProjectRhythm data={data} />
      </div>
      <div className={styles.twoColumns}>
        <StudioBreakdown
          eyebrow="03 / THE BUILDING BLOCKS"
          title="Language palette"
          items={data.breakdowns.languages}
          selected={language}
          onSelect={setLanguage}
        />
        <StudioBreakdown
          eyebrow="04 / YOUR WORKBENCH"
          title="Tools of the trade"
          items={data.breakdowns.editors}
          selected={editor}
          onSelect={setEditor}
        />
      </div>
      <ProjectAiPanel ai={aiFixture} />
      <ProjectFilesPanel
        files={empty ? [] : fileFixtures}
        totalSeconds={72_420}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />
    </main>
  );
}
const meta = {
  title: 'Wakaclock/Project Studio',
  component: Preview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
export const Empty: Story = { args: { empty: true } };
