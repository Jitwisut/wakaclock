import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import type { ProjectAiSummary, ProjectFileItem } from '@/lib/wakaclock/types';

export const split = (seconds: number) => ({
  total_seconds: seconds,
  human_seconds: seconds * 0.3,
  ai_seconds: seconds * 0.7,
  ai_verified_seconds: seconds * 0.6,
  ai_inferred_seconds: seconds * 0.1,
  other_seconds: 0,
  unknown_seconds: 0,
});
const languages = [
  ['Rust', 33_000],
  ['TypeScript', 19_200],
  ['Markdown', 11_220],
  ['Python', 5400],
  ['Bash', 3600],
].map(([name, time]) => ({ key: String(name), name: String(name), total_seconds: Number(time) }));
const editors = [
  ['Codex VS Code', 33_600],
  ['VS Code', 28_200],
  ['Claude Code', 10_620],
].map(([name, time]) => ({ key: String(name), name: String(name), total_seconds: Number(time) }));
const breakdowns = { languages, editors, categories: [], operating_systems: [], projects: [] };
export const studioFixture: AnalyticsExplorerResponse = {
  schema_version: 2,
  generated_at: '2026-09-22T12:00:00Z',
  range: { start: '2026-08-24', end: '2026-09-22', timezone: 'Asia/Bangkok', days_included: 30 },
  summary: { ...split(72_420), active_days: 21, ai_share_percent: 70 },
  breakdowns,
  filter_options: breakdowns,
  applied_filters: {
    category: null,
    editor: null,
    language: null,
    operating_system: null,
    project_id: 'demo',
    source: null,
  },
  calendar_heatmap: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 7, 24 + i)).toISOString().slice(0, 10),
    ...split(i % 7 < 5 ? ((i % 5) + 1) * 900 : 0),
  })),
  time_heatmap: Array.from({ length: 168 }, (_, i) => ({
    weekday: Math.floor(i / 24),
    weekday_name: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
      Math.floor(i / 24)
    ],
    hour: i % 24,
    ...split(i % 24 >= 9 && i % 24 < 19 ? ((i * 7) % 11) * 700 : 0),
  })),
  timeline: {
    bucket_seconds: 86_400,
    items: Array.from({ length: 30 }, (_, i) => ({
      bucket: String(i),
      label: new Date(Date.UTC(2026, 7, 24 + i)).toISOString().slice(5, 10),
      ...split(i % 7 < 5 ? ((i % 5) + 1) * 900 : 0),
    })),
  },
};
export const aiFixture: ProjectAiSummary = {
  ai_lines: 1260,
  ai_verified_lines: 1120,
  ai_inferred_lines: 140,
  human_lines: 580,
  unknown_lines: null,
  unattributed_lines: null,
  ai_percentage: 68.5,
  attribution_coverage_percent: 88,
  sessions: 42,
  prompts: 186,
  prompts_per_session: 4.4,
  tokens: {
    total: 1_246_800,
    input: 932_000,
    output: 314_800,
    cache_read: 54_000,
    cache_write: null,
    coverage_percent: 84,
  },
  estimated_spend: { amount_microusd: 12_480_000, currency: 'USD', coverage_percent: 84 },
};
export const fileFixtures: ProjectFileItem[] = [
  'src/main.rs',
  'tests/broker_process.rs',
  'test/singleFlight.test.ts',
  'src/ai/codex.rs',
  'src/agent_service.rs',
  'components/Overview.tsx',
  'src/api_client.rs',
  'src/broker.rs',
  'lib/seo/site.ts',
  'plans/ROADMAP.md',
  'src/state.rs',
  'config/mod.rs',
].map((path, index) => ({
  entity_key: path,
  path,
  display_name: path.split('/').at(-1) ?? path,
  language: path.endsWith('.rs') ? 'Rust' : 'TypeScript',
  total_seconds: (12 - index) * 420,
  percentage_of_project: (12 - index) * 0.58,
  ai_changes: index * 40,
  ai_verified_changes: index * 30,
  ai_inferred_changes: index * 10,
  human_changes: index * 12,
  unknown_changes: null,
  unattributed_changes: null,
}));
