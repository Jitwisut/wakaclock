import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeMachinePanel, TimeMachinePlayer } from '@/components/wakaclock/analytics/time-machine';
import TimeMachinePage from '@/app/dashboard/(auth)/wakaclock/time-machine/page';
import { navItems } from '@/components/layout/sidebar/nav-items';
import { useCapabilities } from '@/hooks/use-capabilities';
import type { ReplayEvent, ReplayResponse, ReplaySegment } from '@/lib/wakaclock/analytics';
import { WakaclockError } from '@/lib/wakaclock/client';
import { getReplay } from '@/lib/wakaclock/endpoints';
import { listOrganizations } from '@/lib/wakaclock/endpoints-v2';
import { getReplayEvents } from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  actorGroup,
  activeAgentsAt,
  aiSessionBands,
  buildActivityTrack,
  buildReplayTimeline,
  eventsForProject,
  formatReplayMoment,
  latestEventAt,
  nextPosition,
  positionAtWallTime,
  REPLAY_BASE_SECONDS,
  replayEventLabel,
  replayEventMarkers,
  replayEventTone,
  segmentAt,
  snapshotAt,
  wallTimeAt,
} from '@/lib/wakaclock/replay';

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));
const session = vi.hoisted(() => ({ userId: 'user-1' as null | string }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/wakaclock/time-machine',
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.params,
}));
vi.mock('@/hooks/use-capabilities', () => ({ useCapabilities: vi.fn() }));
vi.mock('@/lib/wakaclock/endpoints', () => ({ getReplay: vi.fn() }));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ listOrganizations: vi.fn() }));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({ getReplayEvents: vi.fn() }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (state: { userId: null | string }) => unknown) =>
    select({ userId: session.userId }),
}));
vi.mock('@/components/wakaclock/require-user', () => ({
  RequireUser: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/wakaclock/range-picker', () => ({
  RangePicker: () => <div data-testid="range-picker" />,
}));

const START = 1_785_542_400; // 2026-08-01T00:00:00Z

function segment(start: number, end: number, overrides: Partial<ReplaySegment> = {}) {
  return {
    actor_type: 'human',
    branch: 'main',
    category: 'coding',
    end: START + end,
    language: 'Rust',
    project: 'AtoAxis',
    project_id: 'project-a',
    source: 'editor',
    start: START + start,
    ...overrides,
  } satisfies ReplaySegment;
}

const segments = [
  segment(0, 600),
  segment(600, 900, { actor_type: 'ai_verified', source: 'ai' }),
  // A 2,100 second gap is skipped by playback.
  segment(3_000, 3_300, {
    actor_type: 'ai_inferred',
    language: 'Go',
    project: 'Client',
    project_id: 'project-b',
    source: 'ai',
  }),
  segment(3_300, 3_600, {
    actor_type: 'unknown',
    branch: null,
    language: null,
    project: null,
    project_id: null,
    source: 'other',
  }),
];

function event(at: number, overrides: Partial<ReplayEvent> = {}): ReplayEvent {
  return {
    at: START + at,
    id: `event-${at}`,
    kind: 'pr_opened',
    number: 42,
    project_ids: ['project-a'],
    repository: 'fixture/private',
    url: 'https://github.com/fixture/private/pull/42',
    ...overrides,
  };
}

function replay(overrides: Partial<ReplayResponse> = {}): ReplayResponse {
  return {
    ai_sessions: [{ agent: 'claude-code', end: START + 900, model: null, start: START + 600 }],
    ai_sessions_status: 'available',
    applied_filters: {
      category: null,
      editor: null,
      language: null,
      operating_system: null,
      project_id: null,
      source: null,
    },
    filter_options: {
      categories: [],
      editors: [],
      languages: [{ key: 'Rust', name: 'Rust', total_seconds: 900 }],
      operating_systems: [],
      projects: [],
    },
    generated_at: '2026-08-02T00:00:00Z',
    range: { days_included: 1, end: '2026-08-01', start: '2026-08-01', timezone: 'UTC' },
    schema_version: 1,
    segments,
    summary: {
      ai_seconds: 600,
      human_seconds: 600,
      other_seconds: 300,
      total_seconds: 1_500,
    },
    ...overrides,
  };
}

function renderPanel(element: React.ReactElement = <TimeMachinePanel />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

function stat(label: string) {
  return screen.getByText(label, { selector: 'dt' }).parentElement?.querySelector('dd')
    ?.textContent;
}

describe('replay timeline', () => {
  const timeline = buildReplayTimeline(segments);

  it('skips gaps, so positions count worked seconds', () => {
    expect(timeline.totalSeconds).toBe(1_500);
    expect(timeline.offsets).toEqual([0, 600, 900, 1_200]);
    expect(wallTimeAt(timeline, 950)).toBe(START + 3_050);
    expect(wallTimeAt(timeline, 0)).toBe(START);
    expect(wallTimeAt(timeline, 5_000)).toBe(START + 3_600);
    expect(segmentAt(timeline, 700).actor_type).toBe('ai_verified');
    expect(segmentAt(timeline, 1_500).source).toBe('other');
  });

  it('maps wall time back onto the worked timeline', () => {
    expect(positionAtWallTime(timeline, START + 100)).toBe(100);
    expect(positionAtWallTime(timeline, START + 2_000)).toBe(900);
    expect(positionAtWallTime(timeline, START - 50)).toBe(0);
    expect(positionAtWallTime(timeline, START + 9_000)).toBe(1_500);
  });

  it('ends on exactly the response summary', () => {
    const last = snapshotAt(timeline, timeline.totalSeconds);
    expect(last.totalSeconds).toBe(1_500);
    expect(last.humanSeconds).toBe(600);
    expect(last.aiSeconds).toBe(600);
    expect(last.otherSeconds).toBe(300);
    expect(last.projects.map((item) => [item.key, item.seconds])).toEqual([
      ['project-a', 900],
      ['project-b', 300],
      ['unknown', 300],
    ]);
    expect(last.languages.map((item) => item.name)).toEqual(['Rust', 'Go', 'Unknown']);
  });

  it('accumulates only what has played', () => {
    expect(snapshotAt(timeline, 0).totalSeconds).toBe(0);
    const partial = snapshotAt(timeline, 650);
    expect(partial.humanSeconds).toBe(600);
    expect(partial.aiSeconds).toBe(50);
    expect(partial.projects).toHaveLength(1);
    const unnamed = snapshotAt(buildReplayTimeline([segment(0, 10, { project_id: null })]), 10);
    expect(unnamed.projects[0].key).toBe('AtoAxis');
  });

  it('groups actors for colour and totals', () => {
    expect(actorGroup('human')).toBe('human');
    expect(actorGroup('ai_verified')).toBe('ai');
    expect(actorGroup('ai_inferred')).toBe('ai');
    expect(actorGroup('unknown')).toBe('other');
  });

  it('reduces the track to a bounded number of columns', () => {
    expect(buildActivityTrack(timeline, 5).map((column) => column.group)).toEqual([
      'human',
      'human',
      'ai',
      'ai',
      'other',
    ]);
    const dense = buildReplayTimeline(
      Array.from({ length: 1_000 }, (_, index) => segment(index, index + 1))
    );
    expect(buildActivityTrack(dense, 10)).toHaveLength(10);
  });

  it('places AI sessions on the worked axis and reports who is active', () => {
    expect(aiSessionBands(timeline, replay().ai_sessions)).toEqual([
      { agent: 'claude-code', id: 0, leftPercent: 40, widthPercent: 20 },
    ]);
    const sessions = [
      ...replay().ai_sessions,
      { agent: 'claude-code', end: START + 950, model: 'x', start: START + 700 },
    ];
    expect(activeAgentsAt(sessions, START + 800)).toEqual(['claude-code']);
    expect(activeAgentsAt(sessions, START + 900 + 100)).toEqual([]);
    expect(activeAgentsAt(sessions, START + 100)).toEqual([]);
  });

  it('plays any range in the same time and stops at the end', () => {
    expect(nextPosition(0, REPLAY_BASE_SECONDS * 1000, 1, 1_500)).toBe(1_500);
    expect(nextPosition(0, 1000, 4, 600)).toBe(40);
    expect(nextPosition(1_499, 60_000, 16, 1_500)).toBe(1_500);
  });

  it('formats a moment in the range timezone', () => {
    expect(formatReplayMoment(START, 'UTC')).toContain('Aug 1');
    expect(formatReplayMoment(START, 'UTC')).toContain('00:00');
    expect(formatReplayMoment(START, 'Asia/Bangkok')).toContain('07:00');
  });
});

describe('replay events', () => {
  const timeline = buildReplayTimeline(segments);

  it('labels and colours every kind of event', () => {
    const labels = {
      ci_cancelled: ['PR #42 CI cancelled', 'neutral'],
      ci_failure: ['PR #42 CI failed', 'failure'],
      ci_success: ['PR #42 CI passed', 'success'],
      pr_closed: ['PR #42 closed', 'neutral'],
      pr_first_review: ['PR #42 first review', 'neutral'],
      pr_merged: ['PR #42 merged', 'success'],
      pr_opened: ['PR #42 opened', 'neutral'],
      pr_ready: ['PR #42 ready for review', 'neutral'],
    } as const;
    for (const [kind, [label, tone]] of Object.entries(labels)) {
      const typed = kind as ReplayEvent['kind'];
      expect(replayEventLabel(event(0, { kind: typed }))).toBe(label);
      expect(replayEventTone(typed)).toBe(tone);
    }
  });

  it('keeps every event without a project filter and only matches with one', () => {
    const events = [event(0), event(1, { project_ids: ['project-b'] })];
    expect(eventsForProject(events)).toHaveLength(2);
    expect(eventsForProject(events, 'project-b').map((item) => item.at)).toEqual([START + 1]);
    expect(eventsForProject(events, 'missing')).toEqual([]);
  });

  it('moves an event in a skipped gap to the next worked moment', () => {
    const [inside, inGap, after] = replayEventMarkers(timeline, [
      event(300),
      event(2_000),
      event(9_000),
    ]);
    expect(inside).toMatchObject({ leftPercent: 20, position: 300 });
    expect(inGap).toMatchObject({ leftPercent: 60, position: 900 });
    expect(after).toMatchObject({ leftPercent: 100, position: 1_500 });
  });

  it('finds the latest event that has happened by a moment', () => {
    const events = [event(100), event(200)];
    expect(latestEventAt(events, START + 50)).toBeUndefined();
    expect(latestEventAt(events, START + 150)?.at).toBe(START + 100);
    expect(latestEventAt(events, START + 900)?.at).toBe(START + 200);
  });
});

describe('TimeMachinePlayer', () => {
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
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => frames.push(callback))
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('opens on the finished picture so totals are visible before playing', () => {
    renderPanel(<TimeMachinePlayer data={replay()} />);
    expect(stat('Worked time')).toBe('25m');
    expect(stat('Unknown')).toBe('5m');
    expect(stat('AI share')).toBe('40%');
    expect(screen.getByRole('button', { name: 'Play' })).toHaveTextContent('Replay');
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    const projects = within(screen.getByRole('region', { name: 'Projects' }));
    expect(projects.getByText('AtoAxis')).toBeInTheDocument();
    expect(screen.getByText(/includes counted pauses/)).toBeInTheDocument();
  });

  it('restarts from zero, advances with time and stops at the end', async () => {
    const user = userEvent.setup();
    renderPanel(<TimeMachinePlayer data={replay()} />);

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(stat('Worked time')).toBe('0s');
    expect(screen.getByRole('region', { name: 'Projects' })).toHaveTextContent('Nothing yet.');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    runFrame(1_000);
    runFrame(25_000); // 24s of 60s at 1x is 600s of 1,500s.
    expect(stat('Worked time')).toBe('10m');

    await user.click(screen.getByRole('button', { name: '16x' }));
    expect(screen.getByRole('button', { name: '16x' })).toHaveAttribute('aria-pressed', 'true');
    runFrame(26_000);
    runFrame(600_000);
    expect(stat('Worked time')).toBe('25m');
    expect(screen.getByRole('button', { name: 'Play' })).toHaveTextContent('Replay');
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('pauses, resumes mid-range and pauses again when scrubbed', async () => {
    const user = userEvent.setup();
    renderPanel(<TimeMachinePlayer data={replay()} />);
    const slider = screen.getByRole('slider', { name: 'Replay position' });

    fireEvent.change(slider, { target: { value: '700' } });
    expect(stat('AI')).toBe('1m');
    expect(screen.getByText('AI session: claude-code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toHaveTextContent('Play');
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('00:11'));

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.change(slider, { target: { value: '100' } });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(stat('Human')).toBe('1m');
  });

  it('shows GitHub events on the timeline and reveals them as playback reaches them', () => {
    renderPanel(
      <TimeMachinePlayer
        data={replay()}
        events={[event(100), event(3_200, { kind: 'ci_failure', id: 'ci' })]}
        githubStatus="CI shows the latest result of each check."
      />
    );
    const group = within(screen.getByRole('group', { name: 'GitHub events' }));
    const opened = group.getByRole('link', { name: 'PR #42 opened in fixture/private' });
    const failed = group.getByRole('link', { name: 'PR #42 CI failed in fixture/private' });
    expect(opened).toHaveAttribute('href', 'https://github.com/fixture/private/pull/42');
    expect(opened).toHaveAttribute('rel', 'noreferrer');
    expect(failed).toHaveAttribute('data-tone', 'failure');
    expect(failed).toHaveAttribute('data-played', 'true');
    expect(screen.getByText(/Latest on GitHub/)).toHaveTextContent('PR #42 CI failed');
    expect(screen.getByText(/latest result of each check/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider', { name: 'Replay position' }), {
      target: { value: '500' },
    });
    expect(failed).toHaveAttribute('data-played', 'false');
    expect(opened).toHaveAttribute('data-played', 'true');
    expect(screen.getByText(/Latest on GitHub/)).toHaveTextContent('PR #42 opened');
  });

  it('labels a segment with no project and hides AI bands when there are none', () => {
    const { container } = renderPanel(
      <TimeMachinePlayer
        data={replay({
          ai_sessions: [],
          segments: [segment(0, 60, { branch: null, language: null, project: null })],
        })}
      />
    );
    expect(screen.getByText('Unknown project')).toBeInTheDocument();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('explains why AI sessions are missing', () => {
    const { unmount } = renderPanel(
      <TimeMachinePlayer data={replay({ ai_sessions: [], ai_sessions_status: 'filtered' })} />
    );
    expect(screen.getByText(/hidden while a filter is on/)).toBeInTheDocument();
    unmount();
    renderPanel(
      <TimeMachinePlayer data={replay({ ai_sessions: [], ai_sessions_status: 'not_permitted' })} />
    );
    expect(screen.getByText(/cannot read AI session details/)).toBeInTheDocument();
  });
});

describe('TimeMachinePanel', () => {
  beforeEach(() => {
    navigation.params = new URLSearchParams(
      'start=2026-08-01&end=2026-08-01&timezone=UTC&view=timeline'
    );
    session.userId = 'user-1';
    vi.mocked(useCapabilities).mockReturnValue({
      featureAvailability: { time_machine: true },
      isLoading: false,
      postgresEnabled: true,
      presenceV2Available: false,
    });
  });

  it('requests the filtered range and renders the player with filter options', async () => {
    navigation.params.set('language', 'Rust');
    vi.mocked(getReplay).mockResolvedValue(replay());
    renderPanel();

    expect(await screen.findByRole('region', { name: 'Time Machine replay' })).toBeInTheDocument();
    expect(getReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        end: '2026-08-01',
        language: 'Rust',
        start: '2026-08-01',
        timezone: 'UTC',
      })
    );
    expect(screen.getByRole('option', { name: 'Rust' })).toBeInTheDocument();
  });

  describe('GitHub events', () => {
    const organizations = [
      { id: 'org-1', name: 'First', slug: 'first' },
      { id: 'org-2', name: 'Second', slug: 'second' },
    ];
    const available = {
      events: [event(100)],
      status: 'available' as const,
      unconfirmed_items: 0,
    };

    beforeEach(() => {
      vi.mocked(getReplay).mockResolvedValue(replay());
      vi.mocked(listOrganizations).mockResolvedValue(organizations);
      vi.mocked(getReplayEvents).mockResolvedValue(available);
    });

    it('loads events for the first organization and switches on request', async () => {
      const user = userEvent.setup();
      renderPanel();

      expect(await screen.findByRole('group', { name: 'GitHub events' })).toBeInTheDocument();
      expect(getReplayEvents).toHaveBeenCalledWith('org-1', {
        end: '2026-08-01',
        start: '2026-08-01',
        timezone: 'UTC',
      });
      expect(await screen.findByText(/latest result of each check/)).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('GitHub organization'), 'org-2');
      expect(vi.mocked(getReplayEvents).mock.lastCall?.[0]).toBe('org-2');
    });

    it('applies a project filter to events', async () => {
      navigation.params.set('project_id', 'project-b');
      renderPanel();

      await screen.findByRole('region', { name: 'Time Machine replay' });
      await screen.findByText(/latest result of each check/);
      expect(screen.queryByRole('group', { name: 'GitHub events' })).not.toBeInTheDocument();
    });

    it('hides events and skips the request under a filter they cannot honour', async () => {
      navigation.params.set('language', 'Rust');
      renderPanel();

      expect(await screen.findByText(/filter other than Project/)).toBeInTheDocument();
      expect(getReplayEvents).not.toHaveBeenCalled();
    });

    it('keeps the replay working when GitHub events fail', async () => {
      vi.mocked(getReplayEvents).mockRejectedValue(new WakaclockError('down', 503));
      renderPanel();

      expect(await screen.findByText(/not available for this organization/)).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Time Machine replay' })).toBeInTheDocument();
    });

    it('asks for a verified identity instead of guessing authorship', async () => {
      vi.mocked(getReplayEvents).mockResolvedValue({
        events: [],
        status: 'identity_required',
        unconfirmed_items: 0,
      });
      renderPanel();

      expect(await screen.findByText(/Connect your GitHub account/)).toBeInTheDocument();
    });

    it('says when pull requests are still syncing', async () => {
      vi.mocked(getReplayEvents).mockResolvedValue({ ...available, unconfirmed_items: 2 });
      renderPanel();

      expect(await screen.findByText(/2 of your pull requests/)).toBeInTheDocument();
    });

    it('stays quiet with no events, and with no organization at all', async () => {
      vi.mocked(getReplayEvents).mockResolvedValue({ ...available, events: [] });
      vi.mocked(listOrganizations).mockResolvedValue(organizations.slice(0, 1));
      const { unmount } = renderPanel();
      await screen.findByRole('region', { name: 'Time Machine replay' });
      await vi.waitFor(() => expect(getReplayEvents).toHaveBeenCalled());
      expect(screen.queryByLabelText('GitHub organization')).not.toBeInTheDocument();
      expect(screen.queryByText(/GitHub/)).not.toBeInTheDocument();
      unmount();

      vi.mocked(getReplayEvents).mockClear();
      vi.mocked(listOrganizations).mockResolvedValue([]);
      renderPanel();
      await screen.findByRole('region', { name: 'Time Machine replay' });
      expect(getReplayEvents).not.toHaveBeenCalled();
    });

    it('never asks for organizations without PostgreSQL', async () => {
      vi.mocked(useCapabilities).mockReturnValue({
        featureAvailability: { time_machine: true },
        isLoading: false,
        postgresEnabled: false,
        presenceV2Available: false,
      });
      renderPanel();

      await screen.findByRole('region', { name: 'Time Machine replay' });
      expect(listOrganizations).not.toHaveBeenCalled();
    });
  });

  it('keeps the filter bar usable when a range is refused', async () => {
    vi.mocked(getReplay).mockRejectedValue(
      new WakaclockError('replay range must be at most 92 days', 400)
    );
    renderPanel();

    expect(await screen.findByText('replay range must be at most 92 days')).toBeInTheDocument();
    expect(screen.getByTestId('range-picker')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    vi.mocked(getReplay).mockResolvedValue(replay({ segments: [] }));
    renderPanel();

    expect(await screen.findByText('Nothing to replay')).toBeInTheDocument();
  });

  it('does not call the API on a server without the feature', () => {
    vi.mocked(useCapabilities).mockReturnValue({
      featureAvailability: { time_machine: false },
      isLoading: false,
      postgresEnabled: true,
      presenceV2Available: false,
    });
    renderPanel();

    expect(screen.getByText('Time Machine is not available')).toBeInTheDocument();
    expect(getReplay).not.toHaveBeenCalled();
  });

  it('waits for a signed-in user and capability data', () => {
    session.userId = null;
    vi.mocked(useCapabilities).mockReturnValue({
      featureAvailability: undefined,
      isLoading: true,
      postgresEnabled: undefined,
      presenceV2Available: undefined,
    });
    renderPanel();

    expect(getReplay).not.toHaveBeenCalled();
  });

  it('mounts inside the page and stays behind its server capability in the sidebar', async () => {
    vi.mocked(getReplay).mockResolvedValue(replay());
    renderPanel(<TimeMachinePage />);

    expect(screen.getByRole('heading', { name: 'Time Machine' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Time Machine replay' })).toBeInTheDocument();
    const entry = navItems
      .flatMap((group) => group.items)
      .find((item) => item.href === '/dashboard/wakaclock/time-machine');
    expect(entry?.requiresFeature).toBe('time_machine');
  });

  it('keys cached replays by account and every filter', () => {
    const key = wakaclockKeys.replay('user-1', 'a', 'b', 'UTC', 'p', 'l', 'e', 'c', 's', 'o', 't');
    expect(key).toContain('user-1');
    expect(key).toEqual(expect.arrayContaining(['p', 'l', 'e', 'c', 's', 'o', 't']));
    expect(wakaclockKeys.replay('user-2', 'a', 'b')).not.toEqual(
      wakaclockKeys.replay('user-1', 'a', 'b')
    );
    expect(wakaclockKeys.replayEvents('user-1', 'org-1', 'a', 'b')).not.toEqual(
      wakaclockKeys.replayEvents('user-2', 'org-1', 'a', 'b')
    );
  });
});
