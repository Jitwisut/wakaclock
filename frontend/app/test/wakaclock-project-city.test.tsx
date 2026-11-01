import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeMachinePanel } from '@/components/wakaclock/analytics/time-machine';
import { CityPlayer, TimeMachineCity } from '@/components/wakaclock/analytics/time-machine-city';
import { useCapabilities } from '@/hooks/use-capabilities';
import type { ProjectCityModule, ProjectCityResponse } from '@/lib/wakaclock/analytics';
import { WakaclockError } from '@/lib/wakaclock/client';
import { getProjectAnalytics, getProjectCity } from '@/lib/wakaclock/endpoints';
import { listOrganizations } from '@/lib/wakaclock/endpoints-v2';
import { getReplayEvents } from '@/lib/wakaclock/github-endpoints';
import {
  busiestModuleOn,
  dayIndexOf,
  findShrinks,
  heatColour,
  heatOf,
  languageColour,
  layoutCity,
  linesPerFloor,
  moduleStateAt,
  nextCityDay,
  readHiddenAreas,
  storeHiddenAreas,
  towerFootprint,
} from '@/lib/wakaclock/project-city';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

const device = vi.hoisted(() => ({
  quality: { bloom: false, days: 4, maxDpr: 1, parallax: false, particles: 0 } as null | object,
}));
const created = vi.hoisted(() => ({ options: [] as Array<Record<string, unknown>> }));
const scene = vi.hoisted(() => ({
  burst: vi.fn(),
  dispose: vi.fn(),
  update: vi.fn(),
  zoom: vi.fn(),
}));
const session = vi.hoisted(() => ({ userId: 'user-1' as null | string }));
const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/wakaclock/time-machine',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => navigation.params,
}));
vi.mock('@/components/marketing/time/time-quality', () => ({
  chooseTimeQuality: () => device.quality,
  readDeviceSignals: () => ({}),
}));
vi.mock('@/components/wakaclock/analytics/city/city-scene', () => ({
  createCityScene: (options: Record<string, unknown>) => {
    created.options.push(options);
    return scene;
  },
}));
vi.mock('@/hooks/use-capabilities', () => ({ useCapabilities: vi.fn() }));
vi.mock('@/lib/wakaclock/endpoints', () => ({
  getProjectAnalytics: vi.fn(),
  getProjectCity: vi.fn(),
  getReplay: vi.fn(),
}));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ listOrganizations: vi.fn() }));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({ getReplayEvents: vi.fn() }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (state: { userId: null | string }) => unknown) =>
    select({ userId: session.userId }),
}));
vi.mock('@/components/wakaclock/range-picker', () => ({ RangePicker: () => null }));

function point(day: number, lines: number, files = 3, dependencies = 2) {
  return { day, dependencies, files, lines };
}

function module(path: string, series: ProjectCityModule['series'], language = 'Rust') {
  return {
    area: path.split('/')[0],
    language,
    path,
    series,
    top_files: [{ lines: 300, path: `${path}/main.rs` }],
  };
}

const modules = [
  module('api/services', [point(0, 1000, 4, 10), point(1, 1500, 5, 20), point(2, 900, 5, 12)]),
  module('api/model', [point(1, 200)]),
  module('web/pages', [point(0, 400), point(2, 450)], 'TypeScript'),
];

function city(overrides: Partial<ProjectCityResponse> = {}): ProjectCityResponse {
  return {
    coverage: {
      files_ignored: 5,
      files_included: 12,
      files_outside_root: 1,
      files_without_lines: 2,
    },
    days: ['2026-08-01', '2026-08-02', '2026-08-03'],
    generated_at: '2026-08-04T00:00:00Z',
    modules,
    project_id: 'project-a',
    schema_version: 1,
    timezone: 'UTC',
    ...overrides,
  };
}

function wrap(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

describe('city data', () => {
  it('picks a floor size that keeps the tallest tower readable', () => {
    expect(linesPerFloor(1000)).toBe(25);
    expect(linesPerFloor(40_000)).toBe(1000);
    expect(linesPerFloor(9_000_000)).toBe(10_000);
  });

  it('groups towers into one district per area and centres the city', () => {
    const layout = layoutCity(modules);
    expect(layout.districts.map((district) => district.area).sort()).toEqual(['api', 'web']);
    expect(layout.towers).toHaveLength(3);
    expect(layout.towers.find((t) => t.module.path === 'api/model')?.short).toBe('model');
    expect(new Set(layout.towers.map((t) => `${t.x}:${t.z}`)).size).toBe(3);
    expect(layout.maxDependencies).toBe(20);
    expect(layoutCity([module('root', [point(0, 10)])]).towers[0].short).toBe('root');
    expect(layoutCity([]).towers).toEqual([]);
  });

  it('starts new rows when districts no longer fit', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      module(`area${index}/x`, [point(0, 100 + index)])
    );
    const layout = layoutCity(many);
    expect(new Set(layout.districts.map((district) => district.z)).size).toBeGreaterThan(1);
  });

  it('reads the state on a day and eases toward the next change', () => {
    const [services, model] = modules;
    expect(moduleStateAt(services, 0).lines).toBe(1000);
    expect(moduleStateAt(services, 0.5).lines).toBe(1250);
    expect(moduleStateAt(services, 2).lines).toBe(900);
    expect(moduleStateAt(services, 9).lines).toBe(900);
    expect(moduleStateAt(model, 0)).toEqual({ dependencies: 0, files: 0, lines: 0 });
    const gap = module('x/y', [point(0, 100), point(5, 200)]);
    expect(moduleStateAt(gap, 1.5).lines).toBe(100);
  });

  it('turns dependencies into a heat colour and bounds it', () => {
    expect(heatOf(10, 20)).toBe(0.5);
    expect(heatOf(30, 20)).toBe(1);
    expect(heatColour(0)).toBe('#2bb5a0');
    expect(heatColour(0.5)).toBe('#e8c84a');
    expect(heatColour(1)).toBe('#e0532f');
    expect(heatColour(4)).toBe('#e0532f');
  });

  it('colours known languages and falls back for the rest', () => {
    expect(languageColour('Rust')).toBe('#c4583f');
    expect(languageColour('COBOL')).toBe('#7f9490');
  });

  it('widens towers with files and caps the width', () => {
    expect(towerFootprint(0)).toBe(0);
    expect(towerFootprint(4)).toBeCloseTo(1.98);
    expect(towerFootprint(9000)).toBeCloseTo(3.6);
  });

  it('finds the module with the largest change on a day', () => {
    expect(busiestModuleOn(modules, 0)?.path).toBe('api/services');
    expect(busiestModuleOn(modules, 2)?.path).toBe('api/services');
    expect(busiestModuleOn(modules, 7)).toBeNull();
  });

  it('reports large drops only', () => {
    expect(findShrinks(modules)).toEqual([{ day: 2, path: 'api/services', percent: 40 }]);
    expect(findShrinks([module('a/b', [point(0, 1000), point(1, 950)])])).toEqual([]);
    expect(findShrinks([module('a/b', [point(0, 200), point(1, 130)])])).toEqual([]);
  });

  it('places an event on the last day at or before it', () => {
    const days = ['2026-08-01', '2026-08-05'];
    const third = Date.UTC(2026, 7, 3, 12) / 1000;
    expect(dayIndexOf(days, third, 'UTC')).toBe(0);
    expect(dayIndexOf(days, Date.UTC(2026, 7, 9) / 1000, 'UTC')).toBe(1);
    expect(dayIndexOf(days, Date.UTC(2026, 6, 9) / 1000, 'UTC')).toBe(-1);
    expect(dayIndexOf(['2026-08-02'], Date.UTC(2026, 7, 1, 20) / 1000, 'Asia/Bangkok')).toBe(0);
  });

  it('plays any history in the same time and stops at the end', () => {
    expect(nextCityDay(0, 30_000, 1, 10)).toBe(10);
    expect(nextCityDay(0, 3_000, 3, 10)).toBe(3);
    expect(nextCityDay(9, 60_000, 8, 10)).toBe(10);
  });

  it('remembers hidden districts per project and survives blocked storage', () => {
    storeHiddenAreas('project-a', new Set(['docs']));
    expect(readHiddenAreas('project-a')).toEqual(new Set(['docs']));
    expect(readHiddenAreas('project-b')).toEqual(new Set());
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readHiddenAreas('project-a')).toEqual(new Set());
    expect(() => storeHiddenAreas('project-a', new Set())).not.toThrow();
  });
});

describe('CityPlayer', () => {
  let frames: FrameRequestCallback[];

  function runFrame(now: number) {
    act(() => {
      const pending = frames;
      frames = [];
      pending.forEach((callback) => callback(now));
    });
  }

  beforeEach(() => {
    window.localStorage.clear();
    frames = [];
    created.options = [];
    device.quality = { bloom: false, days: 4, maxDpr: 1, parallax: false, particles: 0 };
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => frames.push(callback))
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('opens on today with the finished totals and loads the scene', async () => {
    wrap(<CityPlayer data={city()} />);

    expect(await screen.findByText('1,550')).toBeInTheDocument();
    expect(screen.getByText('3 August 2026')).toBeInTheDocument();
    await waitFor(() => expect(created.options).toHaveLength(1));
    await waitFor(() =>
      expect(scene.update).toHaveBeenCalledWith(
        expect.objectContaining({ day: 2, lens: 'complexity', progress: 1 })
      )
    );
    expect(screen.getByText(/One floor is 50 lines/)).toBeInTheDocument();
    expect(screen.getByText(/12 files drawn. 6 skipped/)).toBeInTheDocument();
    expect(screen.getByText('api/services lost 40% of its lines')).toBeInTheDocument();
  });

  it('plays from the start, reports the busiest module and stops at the end', async () => {
    const user = userEvent.setup();
    wrap(<CityPlayer data={city()} events={[]} />);

    await user.click(await screen.findByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    runFrame(1_000);
    runFrame(16_000); // 15s of 30s moves one of two days.
    expect(await screen.findByText('2 August 2026')).toBeInTheDocument();
    expect(screen.getByText('Most change: api/services')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '8x' }));
    runFrame(16_100);
    runFrame(40_000);
    expect(await screen.findByRole('button', { name: 'Play' })).toHaveTextContent('Replay');
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('bursts on a passed milestone and pauses when asked or scrubbed', async () => {
    const user = userEvent.setup();
    const at = Date.UTC(2026, 7, 2, 6) / 1000;
    wrap(
      <CityPlayer
        data={city()}
        events={[
          {
            at,
            id: 'merge',
            kind: 'pr_merged',
            number: 7,
            project_ids: ['project-a'],
            repository: 'a/b',
            url: 'https://github.com/a/b/pull/7',
          },
          {
            at: Date.UTC(2020, 0, 1) / 1000,
            id: 'old',
            kind: 'pr_opened',
            number: 1,
            project_ids: ['project-a'],
            repository: 'a/b',
            url: 'https://github.com/a/b/pull/1',
          },
        ]}
      />
    );
    fireEvent.change(await screen.findByRole('slider', { name: 'Day in the project' }), {
      target: { value: '0' },
    });
    await waitFor(() => expect(created.options).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Play' }));
    runFrame(1_000);
    runFrame(16_000);
    expect(scene.burst).toHaveBeenCalledWith('success');
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play' })).toHaveTextContent('Play');

    await user.click(screen.getByRole('button', { name: 'Play' }));
    const slider = screen.getByRole('slider', { name: 'Day in the project' });
    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '1' } });
    expect(screen.getByText('PR #7 merged')).toBeInTheDocument();
  });

  it('selects towers from the scene and the table and shows their files', async () => {
    const user = userEvent.setup();
    wrap(<CityPlayer data={city()} />);
    await waitFor(() => expect(created.options).toHaveLength(1));
    expect(screen.getByText('Select a tower to see its largest files.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /web\/pages/ }));
    expect(screen.getByRole('heading', { name: 'Largest files in web/pages' })).toBeInTheDocument();
    expect(screen.getByText('web/pages/main.rs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Language' }));
    expect(screen.getByText('Mostly TypeScript')).toBeInTheDocument();

    const { layout, onSelect } = created.options[0] as {
      layout: { towers: Array<{ module: { path: string } }> };
      onSelect(tower: unknown): void;
    };
    act(() => onSelect(layout.towers.find((t) => t.module.path === 'api/services')));
    expect(
      screen.getByRole('heading', { name: 'Largest files in api/services' })
    ).toBeInTheDocument();
  });

  it('shows a tower tip on hover, clears it and zooms', async () => {
    const user = userEvent.setup();
    wrap(<CityPlayer data={city()} />);
    await waitFor(() => expect(created.options).toHaveLength(1));
    const { layout, onHover } = created.options[0] as {
      layout: { towers: unknown[] };
      onHover(tower: unknown, event: unknown): void;
    };
    act(() => onHover(layout.towers[0], { clientX: 40, clientY: 90 }));
    expect(screen.getByText(/lines · \d+ files · \d+ dependencies/)).toBeInTheDocument();
    act(() => onHover(null, { clientX: 0, clientY: 0 }));
    expect(screen.queryByText(/lines · \d+ files/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(scene.zoom).toHaveBeenNthCalledWith(1, 0.82);
    expect(scene.zoom).toHaveBeenNthCalledWith(2, 1.22);
  });

  it('hides a district, remembers it and brings it back', async () => {
    const user = userEvent.setup();
    wrap(<CityPlayer data={city()} />);
    const districts = within(await screen.findByRole('group', { name: 'Districts shown' }));

    await user.click(districts.getByRole('button', { name: 'api' }));
    expect(screen.queryByRole('button', { name: /api\/services/ })).not.toBeInTheDocument();
    expect(readHiddenAreas('project-a')).toEqual(new Set(['api']));

    await user.click(districts.getByRole('button', { name: 'api' }));
    expect(screen.getByRole('button', { name: /api\/services/ })).toBeInTheDocument();
  });

  it('falls back to the table without loading 3D', async () => {
    device.quality = null;
    wrap(<CityPlayer data={city({ days: ['2026-08-01'], modules: [modules[2]] })} />);

    expect(await screen.findByText(/3D is off on this device/)).toBeInTheDocument();
    expect(created.options).toHaveLength(0);
    expect(screen.getByRole('button', { name: /web\/pages/ })).toBeInTheDocument();
  });

  it('disposes the scene when it leaves the page', async () => {
    const { unmount } = wrap(<CityPlayer data={city()} />);
    await waitFor(() => expect(created.options).toHaveLength(1));
    unmount();
    expect(scene.dispose).toHaveBeenCalled();
  });
});

describe('TimeMachineCity', () => {
  const items = [
    { name: 'Shop', project_id: 'project-a' },
    { name: 'Blog', project_id: 'project-b' },
  ];

  beforeEach(() => {
    session.userId = 'user-1';
    created.options = [];
    device.quality = null;
    vi.mocked(getProjectAnalytics).mockResolvedValue({ items } as never);
    vi.mocked(getProjectCity).mockResolvedValue(city());
  });

  it('builds the busiest project first and switches on request', async () => {
    const user = userEvent.setup();
    wrap(<TimeMachineCity timezone="Asia/Bangkok" />);

    expect(await screen.findByRole('region', { name: 'Project city' })).toBeInTheDocument();
    expect(getProjectCity).toHaveBeenCalledWith('project-a', 'Asia/Bangkok');
    await user.selectOptions(screen.getByLabelText('Project'), 'project-b');
    await waitFor(() =>
      expect(getProjectCity).toHaveBeenLastCalledWith('project-b', 'Asia/Bangkok')
    );
  });

  it('explains a project with no line counts', async () => {
    vi.mocked(getProjectCity).mockResolvedValue(city({ modules: [] }));
    wrap(<TimeMachineCity timezone="UTC" />);

    expect(await screen.findByText(/2 files were tracked/)).toBeInTheDocument();
  });

  it('explains a project with no files at all', async () => {
    vi.mocked(getProjectCity).mockResolvedValue(
      city({
        coverage: {
          files_ignored: 0,
          files_included: 0,
          files_outside_root: 0,
          files_without_lines: 0,
        },
        modules: [],
      })
    );
    wrap(<TimeMachineCity timezone="UTC" />);

    expect(await screen.findByText(/No source files were recorded/)).toBeInTheDocument();
  });

  it('invites tracking when there are no projects', async () => {
    vi.mocked(getProjectAnalytics).mockResolvedValue({ items: [] } as never);
    wrap(<TimeMachineCity timezone="UTC" />);

    expect(await screen.findByText(/Track a project/)).toBeInTheDocument();
    expect(getProjectCity).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument();
  });

  it('shows why a project could not be drawn', async () => {
    vi.mocked(getProjectCity).mockRejectedValue(
      new WakaclockError('project history is too large to draw', 400)
    );
    wrap(<TimeMachineCity timezone="UTC" />);

    expect(await screen.findByText('project history is too large to draw')).toBeInTheDocument();
  });

  it('waits for a signed-in user', () => {
    session.userId = null;
    wrap(<TimeMachineCity timezone="UTC" />);

    expect(getProjectAnalytics).not.toHaveBeenCalled();
  });

  it('keys cached cities by account and project', () => {
    expect(wakaclockKeys.projectCity('user-1', 'project-a')).not.toEqual(
      wakaclockKeys.projectCity('user-2', 'project-a')
    );
  });
});

describe('Time Machine views', () => {
  beforeEach(() => {
    device.quality = null;
    session.userId = 'user-1';
    navigation.params = new URLSearchParams('start=2026-08-01&end=2026-08-01&timezone=UTC');
    vi.mocked(useCapabilities).mockReturnValue({
      featureAvailability: { time_machine: true },
      isLoading: false,
      postgresEnabled: false,
      presenceV2Available: false,
    });
    vi.mocked(getProjectAnalytics).mockResolvedValue({
      items: [{ name: 'Shop', project_id: 'project-a' }],
    } as never);
    vi.mocked(getProjectCity).mockResolvedValue(city());
    vi.mocked(listOrganizations).mockResolvedValue([]);
    vi.mocked(getReplayEvents).mockResolvedValue({
      events: [],
      status: 'available',
      unconfirmed_items: 0,
    });
  });

  it('opens on the city and switches to the timeline', async () => {
    const user = userEvent.setup();
    wrap(<TimeMachinePanel />);

    expect(await screen.findByRole('region', { name: 'Project city' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'City' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.queryByRole('region', { name: 'Project city' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
