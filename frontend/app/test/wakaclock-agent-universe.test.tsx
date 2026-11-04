import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgentUniversePage from '@/app/dashboard/(auth)/wakaclock/agents/page';
import { navItems } from '@/components/layout/sidebar/nav-items';
import { AgentUniversePanel, UniversePlayer } from '@/components/wakaclock/agents/agent-universe';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useDeliveryHealth } from '@/hooks/use-delivery-health';
import {
  activityColumns,
  agentColour,
  busiestClock,
  edgeKey,
  formatAgo,
  formatCost,
  formatTokens,
  layoutUniverse,
  liveOverlay,
  nextClock,
  rangeReachesToday,
  selectionName,
  topLinks,
  universeBounds,
  universeStateAt,
  withLive,
} from '@/lib/wakaclock/agent-universe';
import type {
  AgentLiveResponse,
  AgentUniverseResponse,
  LiveAgentActivity,
  UniverseAgent,
} from '@/lib/wakaclock/analytics';
import { WakaclockError } from '@/lib/wakaclock/client';
import { getAgentLive, getAgentUniverse } from '@/lib/wakaclock/endpoints-v2';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

const device = vi.hoisted(() => ({ quality: { maxDpr: 1 } as null | object, reduced: false }));
const created = vi.hoisted(() => ({ options: [] as Array<Record<string, unknown>> }));
const scene = vi.hoisted(() => ({ dispose: vi.fn(), update: vi.fn(), zoom: vi.fn() }));
const session = vi.hoisted(() => ({ userId: 'user-1' as null | string }));
const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/wakaclock/agents',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => navigation.params,
}));
vi.mock('@/components/marketing/time/time-quality', () => ({
  chooseTimeQuality: () => device.quality,
  readDeviceSignals: () => ({ reducedMotion: device.reduced }),
}));
vi.mock('@/components/wakaclock/agents/universe-scene', () => ({
  createUniverseScene: (options: Record<string, unknown>) => {
    created.options.push(options);
    return scene;
  },
}));
vi.mock('@/components/wakaclock/range-picker', () => ({
  RangePicker: () => <div data-testid="range-picker" />,
}));
vi.mock('@/components/wakaclock/require-user', () => ({
  RequireUser: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/hooks/use-capabilities', () => ({ useCapabilities: vi.fn() }));
vi.mock('@/hooks/use-delivery-health', () => ({ useDeliveryHealth: vi.fn() }));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  getAgentLive: vi.fn(),
  getAgentUniverse: vi.fn(),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (state: { userId: null | string }) => unknown) =>
    select({ userId: session.userId }),
}));

const HOUR = 1_793_232_000;

function agent(name: string, overrides: Partial<UniverseAgent> = {}): UniverseAgent {
  return {
    cost_microusd: 3_500_000,
    cost_status: 'complete',
    events: 10,
    model: 'model-a',
    name,
    prompts: 12,
    sessions: 2,
    tokens: 2_500_000,
    ...overrides,
  };
}

function universe(overrides: Partial<AgentUniverseResponse> = {}): AgentUniverseResponse {
  return {
    activity: [
      { agent: 0, hour: HOUR, project: 0, session: 0, tokens: 1_000_000 },
      { agent: 1, hour: HOUR, project: 1, session: 1, tokens: 400_000 },
      { agent: 0, hour: HOUR + 3600, project: 1, session: 0, tokens: 500_000 },
      { agent: 0, hour: HOUR + 7200, project: 0, session: 2, tokens: 250_000 },
      { agent: 0, hour: HOUR + 7200, project: 0, session: 3, tokens: 250_000 },
      { agent: 1, hour: HOUR + 86_400, project: 0, session: 1, tokens: 100_000 },
    ],
    agents: [
      agent('Claude Code'),
      agent('codex', {
        cost_microusd: null,
        cost_status: 'unavailable',
        model: null,
        prompts: null,
      }),
    ],
    coverage: {
      events: 40,
      events_with_inferred_project: 9,
      events_without_project: 2,
      last_event_at: HOUR + 86_400,
      projects_total: 20,
    },
    projects: [
      { key: 'a', name: 'Shop', sessions: 3, tokens: 1_600_000 },
      { key: 'b', name: 'Blog', sessions: 2, tokens: 900_000 },
    ],
    range: { days_included: 30, end: '2026-10-31', start: '2026-10-01', timezone: 'UTC' },
    schema_version: 1,
    ...overrides,
  };
}

const NOW = HOUR + 90_000;

function seen(name: string, overrides: Partial<LiveAgentActivity> = {}): LiveAgentActivity {
  return {
    agent: name,
    heartbeats: 4,
    last_seen_at: NOW - 150,
    model: null,
    project_key: 'a',
    project_name: 'Shop',
    ...overrides,
  };
}

function liveData(overrides: Partial<AgentLiveResponse> = {}): AgentLiveResponse {
  return {
    activity: [seen('codex', { model: 'gpt-5-codex' }), seen('Claude Code', { last_seen_at: NOW })],
    coverage: {
      future_heartbeats: 0,
      heartbeats: 8,
      heartbeats_without_project: 0,
      truncated: false,
      unverified_heartbeats: 0,
    },
    schema_version: 1,
    server_time: NOW,
    window_seconds: 900,
    ...overrides,
  };
}

function wrap(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

describe('universe data', () => {
  it('colours known agents by name and gives the rest a stable colour', () => {
    expect(agentColour('Claude Code', 3)).toBe('#f0a067');
    expect(agentColour('codex', 0)).toBe('#41d6a6');
    expect(agentColour('mystery', 1)).toBe('#7fd1e6');
    expect(agentColour('mystery', 5)).toBe('#7fd1e6');
  });

  it('places every agent and project, with projects on the outer ring', () => {
    const layout = layoutUniverse(universe());
    expect(layout.agents).toHaveLength(2);
    expect(layout.projects).toHaveLength(2);
    for (const [x, , z] of layout.projects) expect(Math.hypot(x, z)).toBeCloseTo(21);
    for (const [x, , z] of layout.agents) expect(Math.hypot(x, z)).toBeCloseTo(8.5);
    expect(layout.agents[0][1]).toBe(-2);
    expect(layout.agents[1][1]).toBe(2);
  });

  it('breaks a tie in project order deterministically', () => {
    const tied = universe({
      activity: [
        { agent: 0, hour: HOUR, project: 0, session: 0, tokens: 1 },
        { agent: 0, hour: HOUR, project: 1, session: 0, tokens: 1 },
      ],
    });
    expect(layoutUniverse(tied)).toEqual(layoutUniverse(tied));
  });

  it('accumulates only what has happened by a moment', () => {
    const data = universe();
    const early = universeStateAt(data, HOUR);
    expect(early.tokens).toBe(1_400_000);
    expect(early.agentTokens).toEqual([1_000_000, 400_000]);
    expect(early.projectTokens).toEqual([1_000_000, 400_000]);
    expect(early.sessions.size).toBe(2);
    const all = universeStateAt(data, HOUR + 90_000);
    expect(all.tokens).toBe(2_500_000);
    expect(all.edges.get(edgeKey(0, 0))).toEqual({
      sessions: new Set([0, 2, 3]),
      tokens: 1_500_000,
    });
  });

  it('treats only recent hours as live and cools them with age', () => {
    const data = universe();
    expect(universeStateAt(data, HOUR + 3600).live).toHaveLength(3);
    const state = universeStateAt(data, HOUR + 7200);
    expect(state.liveHeat.get(edgeKey(0, 0))).toBe(1);
    expect(state.liveHeat.get(edgeKey(1, 1))).toBe(0.5);
    expect(universeStateAt(data, HOUR + 80_000).live).toHaveLength(0);
  });

  it('leaves hidden agents out of every total', () => {
    const state = universeStateAt(universe(), HOUR + 90_000, new Set([0]));
    expect(state.tokens).toBe(500_000);
    expect(state.agentTokens[0]).toBe(0);
    expect(state.edges.has(edgeKey(0, 0))).toBe(false);
  });

  it('finds the range bounds and the busiest hour', () => {
    expect(universeBounds(universe())).toEqual({ first: HOUR, last: HOUR + 90_000 });
    expect(busiestClock(universe())).toBe(HOUR);
    const later = universe({
      activity: [
        { agent: 0, hour: HOUR, project: 0, session: 0, tokens: 1 },
        { agent: 0, hour: HOUR + 3600, project: 0, session: 0, tokens: 1 },
        { agent: 1, hour: HOUR + 3600, project: 0, session: 1, tokens: 1 },
      ],
    });
    expect(busiestClock(later)).toBe(HOUR + 3600);
  });

  it('sizes activity columns and marks empty ones', () => {
    const columns = activityColumns(universe(), 25);
    expect(columns).toHaveLength(25);
    expect(columns[0]).toMatchObject({ column: 0, share: 1 });
    expect(columns.at(-1)?.agent).toBe(1);
    expect(columns[10]).toMatchObject({ agent: null, share: 0 });
  });

  it('plays any range in the same time and stops at the end', () => {
    expect(nextClock(0, 50_000, 1, 0, 1000)).toBe(1000);
    expect(nextClock(0, 5_000, 2, 0, 1000)).toBe(200);
    expect(nextClock(990, 50_000, 8, 0, 1000)).toBe(1000);
  });

  it('never shows an unknown cost as zero', () => {
    expect(formatCost(agent('a'))).toBe('$3.50');
    expect(formatCost(agent('a', { cost_status: 'partial' }))).toBe('At least $3.50');
    expect(formatCost(agent('a', { cost_microusd: null, cost_status: 'unavailable' }))).toBe(
      'Not reported'
    );
  });

  it('shortens token counts', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(12_500)).toBe('13K');
    expect(formatTokens(2_500_000)).toBe('2.5M');
  });

  it('lists the strongest links of an agent or a project', () => {
    const data = universe();
    const state = universeStateAt(data, HOUR + 90_000);
    expect(topLinks(data, state, { index: 0, kind: 'agent' }, 4)).toEqual([
      { name: 'Shop', tokens: 1_500_000 },
      { name: 'Blog', tokens: 500_000 },
    ]);
    expect(topLinks(data, state, { index: 1, kind: 'project' }, 1)).toEqual([
      { name: 'Claude Code', tokens: 500_000 },
    ]);
    expect(selectionName({ index: 1, kind: 'agent' }, data.agents, data.projects)).toBe('codex');
    expect(selectionName({ index: 1, kind: 'project' }, data.agents, data.projects)).toBe('Blog');
  });

  it('keys cached universes by account', () => {
    expect(wakaclockKeys.agentUniverse('user-1', 'a', 'b')).not.toEqual(
      wakaclockKeys.agentUniverse('user-2', 'a', 'b')
    );
    expect(wakaclockKeys.agentLive('user-1')).not.toEqual(wakaclockKeys.agentLive('user-2'));
  });
});

describe('live data', () => {
  it('places live agents on the sky with their own session numbers and heat', () => {
    const overlay = liveOverlay(universe(), liveData());

    expect(overlay.unplaced).toBe(0);
    expect(overlay.comets).toEqual([
      { agent: 1, hour: NOW - 150, project: 0, session: -1, tokens: 4 },
      { agent: 0, hour: NOW, project: 0, session: -2, tokens: 4 },
    ]);
    expect(overlay.heat.get(edgeKey(0, 0))).toBe(1);
    expect(overlay.heat.get(edgeKey(1, 0))).toBeCloseTo(1 - 150 / 900);
  });

  it('keeps the strongest heat for a pair and never lets it fade out', () => {
    const overlay = liveOverlay(
      universe(),
      liveData({
        activity: [
          seen('codex', { last_seen_at: NOW - 890 }),
          seen('codex', { last_seen_at: NOW - 900, project_key: 'x' }),
        ],
        server_time: NOW,
      })
    );
    expect(overlay.heat.get(edgeKey(1, 0))).toBe(0.15);
    expect(overlay.unplaced).toBe(1);
  });

  it('sends only a folded project to the other planet', () => {
    const data = universe({
      projects: [
        { key: 'a', name: 'Shop', sessions: 3, tokens: 1_600_000 },
        {
          folded_keys: ['small'],
          key: 'other',
          name: '8 other projects',
          sessions: 2,
          tokens: 900_000,
        },
      ],
    });
    const overlay = liveOverlay(
      data,
      liveData({
        activity: [
          seen('codex', { project_key: 'small' }),
          seen('codex', { project_key: 'never-in-range' }),
          seen('codex', { project_key: 'other' }),
          seen('codex', { project_key: 'unassigned' }),
          seen('gemini-cli'),
        ],
      })
    );
    expect(overlay.comets.map((item) => item.project)).toEqual([1]);
    expect(overlay.unplaced).toBe(4);
  });

  it('replaces the recent glow and leaves hidden agents out', () => {
    const data = universe();
    const base = universeStateAt(data, HOUR + 90_000);
    const state = withLive(base, liveOverlay(data, liveData()), new Set([1]));

    expect(state.tokens).toBe(base.tokens);
    expect(state.live.map((item) => item.agent)).toEqual([0]);
    expect([...state.liveHeat.keys()]).toEqual([edgeKey(0, 0)]);
  });

  it('says how long ago and whether a range reaches today', () => {
    expect(formatAgo(30)).toBe('just now');
    expect(formatAgo(185)).toBe('3 min ago');
    const now = new Date('2026-11-02T20:00:00Z');
    expect(rangeReachesToday('2026-11-02', 'UTC', now)).toBe(true);
    expect(rangeReachesToday('2026-11-02', 'Asia/Bangkok', now)).toBe(false);
    expect(rangeReachesToday('2026-10-31', 'UTC', now)).toBe(false);
  });
});

describe('UniversePlayer', () => {
  let frames: FrameRequestCallback[];

  function runFrame(now: number) {
    act(() => {
      const pending = frames;
      frames = [];
      pending.forEach((callback) => callback(now));
    });
  }

  beforeEach(() => {
    frames = [];
    created.options = [];
    device.quality = { maxDpr: 1 };
    device.reduced = false;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => frames.push(callback))
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('opens on the busiest hour and loads the scene', async () => {
    wrap(<UniversePlayer data={universe()} />);

    await waitFor(() => expect(created.options).toHaveLength(1));
    expect(created.options[0]).toMatchObject({ maxDpr: 1, reducedMotion: false });
    await waitFor(() =>
      expect(scene.update).toHaveBeenCalledWith(
        expect.objectContaining({ playing: false, selection: null })
      )
    );
    expect(screen.getByText('1.4M tokens so far')).toBeInTheDocument();
    expect(screen.getByText('sessions in the last 4 hours').previousSibling).toHaveTextContent('2');
  });

  it('marks missing values instead of showing zero', () => {
    wrap(<UniversePlayer data={universe()} />);
    const row = within(screen.getByRole('table')).getByText('codex').closest('tr') as HTMLElement;

    expect(within(row).getAllByText('Not reported')).toHaveLength(2);
    expect(screen.getByText(/This is history, not live/)).toHaveTextContent(
      '9 of 40 events have a project that was not explicitly reported. 2 events have no project.'
    );
    expect(screen.getByText(/largest projects out of 20/)).toBeInTheDocument();
  });

  it('leaves out coverage warnings that do not apply', () => {
    wrap(
      <UniversePlayer
        data={universe({
          coverage: {
            events: 40,
            events_with_inferred_project: 0,
            events_without_project: 0,
            last_event_at: HOUR,
            projects_total: 2,
          },
        })}
      />
    );

    expect(screen.getByText(/This is history/)).not.toHaveTextContent('explicitly');
    expect(screen.queryByText(/largest projects/)).not.toBeInTheDocument();
  });

  it('plays, speeds up, stops at the end and replays from the start', async () => {
    const user = userEvent.setup();
    wrap(<UniversePlayer data={universe()} />);

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '8x' }));
    expect(screen.getByRole('button', { name: '8x' })).toHaveAttribute('aria-pressed', 'true');
    runFrame(1_000);
    runFrame(500_000);
    expect(await screen.findByRole('button', { name: 'Play' })).toHaveTextContent('Replay');

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('slider', { name: 'Time in the selected range' })).toHaveValue(
      String(HOUR)
    );
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play' })).toHaveTextContent('Play');
  });

  it('pauses when scrubbed', async () => {
    const user = userEvent.setup();
    wrap(<UniversePlayer data={universe()} />);

    await user.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Time in the selected range' }), {
      target: { value: String(HOUR + 3600) },
    });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByText('1.9M tokens so far')).toBeInTheDocument();
  });

  it('turns an agent off and back on', async () => {
    const user = userEvent.setup();
    wrap(<UniversePlayer data={universe()} />);
    const group = within(screen.getByRole('group', { name: 'Agents shown' }));

    await user.click(group.getByRole('button', { name: 'Claude Code' }));
    expect(screen.getByText('400K tokens so far')).toBeInTheDocument();
    await user.click(group.getByRole('button', { name: 'Claude Code' }));
    expect(screen.getByText('1.4M tokens so far')).toBeInTheDocument();
  });

  it('shows details for a selected agent or project and clears them', async () => {
    const user = userEvent.setup();
    wrap(<UniversePlayer data={universe()} />);
    await waitFor(() => expect(created.options).toHaveLength(1));
    expect(screen.getByText(/Select a star or a planet/)).toBeInTheDocument();

    const table = within(screen.getByRole('table'));
    await user.click(table.getByRole('button', { name: 'Claude Code' }));
    expect(screen.getByRole('heading', { name: 'Claude Code' })).toBeInTheDocument();
    expect(screen.getByText('model-a')).toBeInTheDocument();

    await user.click(table.getByRole('button', { name: 'codex' }));
    expect(screen.queryByText('Latest model')).not.toBeInTheDocument();

    const { onSelect } = created.options[0] as { onSelect(value: unknown): void };
    act(() => onSelect({ index: 0, kind: 'project' }));
    expect(screen.getByRole('heading', { name: 'Shop' })).toBeInTheDocument();
    expect(screen.getByText('Sessions in range')).toBeInTheDocument();
    act(() => onSelect(null));
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
  });

  it('zooms and disposes the scene', async () => {
    const user = userEvent.setup();
    const { unmount } = wrap(<UniversePlayer data={universe()} />);
    await waitFor(() => expect(created.options).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(scene.zoom).toHaveBeenNthCalledWith(1, 0.82);
    expect(scene.zoom).toHaveBeenNthCalledWith(2, 1.22);
    unmount();
    expect(scene.dispose).toHaveBeenCalled();
  });

  it('cannot go live on a range that ends before today', () => {
    const onToggle = vi.fn();
    wrap(
      <UniversePlayer
        data={universe()}
        live={{ available: false, enabled: false, failed: false, onToggle }}
      />
    );
    const button = screen.getByRole('button', { name: 'Live' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Live needs a range that includes today');
  });

  it('switches to live mode and back', async () => {
    const onToggle = vi.fn();
    const { rerender } = wrap(
      <UniversePlayer
        data={universe()}
        live={{ available: true, enabled: false, failed: false, onToggle }}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Live' }));
    expect(onToggle).toHaveBeenLastCalledWith(true);

    const client = new QueryClient();
    rerender(
      <QueryClientProvider client={client}>
        <UniversePlayer
          data={universe()}
          live={{
            available: true,
            data: liveData(),
            enabled: true,
            failed: false,
            notice: <p>queue warning</p>,
            onToggle,
          }}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('Live: latest activity')).toBeInTheDocument();
    expect(
      screen.getByText('agents drawn from the last 15 minutes').previousSibling
    ).toHaveTextContent('2');
    expect(screen.getByText(/tokens in range/)).toBeInTheDocument();
    expect(screen.getByText('codex on Shop · gpt-5-codex')).toBeInTheDocument();
    expect(screen.getByText('2 min ago')).toBeInTheDocument();
    expect(screen.getByText('Claude Code on Shop')).toBeInTheDocument();
    expect(screen.getByText('just now')).toBeInTheDocument();
    expect(screen.getByText('queue warning')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(screen.getByRole('slider')).toBeDisabled();
    await waitFor(() =>
      expect(scene.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          state: expect.objectContaining({
            live: expect.arrayContaining([expect.objectContaining({ session: -1 })]),
          }),
        })
      )
    );

    await userEvent.click(screen.getByRole('button', { name: 'Live' }));
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it('explains what live mode could not show', () => {
    const live = liveData({
      activity: [seen('gemini-cli', { project_name: 'Lab' })],
      coverage: {
        future_heartbeats: 1,
        heartbeats: 4,
        heartbeats_without_project: 0,
        truncated: true,
        unverified_heartbeats: 1200,
      },
    });
    wrap(
      <UniversePlayer
        data={universe()}
        live={{ available: true, data: live, enabled: true, failed: true, onToggle: vi.fn() }}
      />
    );
    expect(screen.getByText('gemini-cli on Lab')).toBeInTheDocument();
    expect(screen.getByText(/1 of these are not on this range's sky/)).toBeInTheDocument();
    expect(screen.getByText(/1,200 heartbeats came from agents/)).toBeInTheDocument();
    expect(screen.getByText(/^1 heartbeat came from a device clock ahead/)).toBeInTheDocument();
    expect(screen.getByText(/Only the latest agent activity is live/)).toBeInTheDocument();
    expect(screen.getByText('Only the 1 most recent pairs are shown.')).toBeInTheDocument();
    expect(
      screen.getByText(/could not be refreshed. Showing the last result./)
    ).toBeInTheDocument();
  });

  it('shows waiting, empty and failed live states', () => {
    const onToggle = vi.fn();
    const { rerender } = wrap(
      <UniversePlayer
        data={universe()}
        live={{ available: true, enabled: true, failed: false, onToggle }}
      />
    );
    expect(screen.getByText('Checking for agent activity…')).toBeInTheDocument();
    expect(
      screen.getByText('agents drawn from the last 15 minutes').previousSibling
    ).toHaveTextContent('0');

    const client = new QueryClient();
    rerender(
      <QueryClientProvider client={client}>
        <UniversePlayer
          data={universe()}
          live={{
            available: true,
            data: liveData({ activity: [] }),
            enabled: true,
            failed: false,
            onToggle,
          }}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('No agent activity in the last 15 minutes.')).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={client}>
        <UniversePlayer
          data={universe()}
          live={{ available: true, enabled: true, failed: true, onToggle }}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText(/could not be refreshed\.\s*$/)).toBeInTheDocument();
    expect(screen.queryByText('Checking for agent activity…')).not.toBeInTheDocument();
  });

  it('falls back to the tables without loading 3D', async () => {
    device.quality = null;
    wrap(<UniversePlayer data={universe()} />);

    expect(await screen.findByText(/3D is off on this device/)).toBeInTheDocument();
    expect(created.options).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument();
  });
});

describe('AgentUniversePanel', () => {
  beforeEach(() => {
    session.userId = 'user-1';
    device.quality = null;
    navigation.params = new URLSearchParams('start=2026-10-01&end=2026-10-31');
    vi.mocked(useCapabilities).mockReturnValue({
      featureAvailability: { agent_universe: true },
      isLoading: false,
      postgresEnabled: true,
      presenceV2Available: false,
    });
    vi.mocked(getAgentUniverse).mockResolvedValue(universe());
    vi.mocked(getAgentLive).mockResolvedValue(liveData());
    vi.mocked(useDeliveryHealth).mockReturnValue({
      deadLetter: 0,
      devices: [],
      incomplete: false,
      message: 'All data delivered.',
      pending: 0,
      state: 'complete',
    });
  });

  it('polls live activity only while live is on', async () => {
    navigation.params = new URLSearchParams('start=2026-10-01&end=2999-12-31');
    vi.mocked(useDeliveryHealth).mockReturnValue({
      deadLetter: 0,
      devices: [],
      incomplete: true,
      message: '12 heartbeats are still queued on this device.',
      pending: 12,
      state: 'pending',
    });
    wrap(<AgentUniversePanel />);

    const button = await screen.findByRole('button', { name: 'Live' });
    expect(getAgentLive).not.toHaveBeenCalled();
    await userEvent.click(button);
    expect(await screen.findByText('codex on Shop · gpt-5-codex')).toBeInTheDocument();
    expect(getAgentLive).toHaveBeenCalledTimes(1);
    expect(screen.getByText('12 heartbeats are still queued on this device.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Live' }));
    expect(screen.queryByText('Latest agent activity')).not.toBeInTheDocument();
  });

  it('shows no delivery warning when everything has arrived', async () => {
    navigation.params = new URLSearchParams('start=2026-10-01&end=2999-12-31');
    wrap(<AgentUniversePanel />);

    await userEvent.click(await screen.findByRole('button', { name: 'Live' }));
    expect(await screen.findByText('codex on Shop · gpt-5-codex')).toBeInTheDocument();
    expect(screen.queryByText('All data delivered.')).not.toBeInTheDocument();
  });

  it('keeps live off for a range in the past', async () => {
    wrap(<AgentUniversePanel />);

    expect(await screen.findByRole('button', { name: 'Live' })).toBeDisabled();
    expect(getAgentLive).not.toHaveBeenCalled();
  });

  it('requests the range and renders the page', async () => {
    wrap(<AgentUniversePage />);

    expect(screen.getByRole('heading', { name: 'Agent Universe' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Agent universe' })).toBeInTheDocument();
    expect(getAgentUniverse).toHaveBeenCalledWith(
      expect.objectContaining({ end: '2026-10-31', start: '2026-10-01' })
    );
    const entry = navItems
      .flatMap((group) => group.items)
      .find((item) => item.href === '/dashboard/wakaclock/agents');
    expect(entry?.requiresFeature).toBe('agent_universe');
  });

  it('shows an empty sky', async () => {
    vi.mocked(getAgentUniverse).mockResolvedValue(universe({ activity: [], agents: [] }));
    wrap(<AgentUniversePanel />);

    expect(await screen.findByText('The sky is empty')).toBeInTheDocument();
  });

  it('keeps the range picker usable when a range is refused', async () => {
    vi.mocked(getAgentUniverse).mockRejectedValue(
      new WakaclockError('agent universe range must be at most 92 days', 400)
    );
    wrap(<AgentUniversePanel />);

    expect(await screen.findByText(/at most 92 days/)).toBeInTheDocument();
    expect(screen.getByTestId('range-picker')).toBeInTheDocument();
  });

  it('does not call the API on a server without the feature', () => {
    vi.mocked(useCapabilities).mockReturnValue({
      featureAvailability: { agent_universe: false },
      isLoading: false,
      postgresEnabled: true,
      presenceV2Available: false,
    });
    wrap(<AgentUniversePanel />);

    expect(screen.getByText('Agent Universe is not available')).toBeInTheDocument();
    expect(getAgentUniverse).not.toHaveBeenCalled();
  });

  it('waits for a signed-in user', () => {
    session.userId = null;
    wrap(<AgentUniversePanel />);

    expect(getAgentUniverse).not.toHaveBeenCalled();
  });
});
