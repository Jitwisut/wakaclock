import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeCore } from '@/components/wakaclock/time-core/time-core';
import { todayDateString } from '@/lib/wakaclock/format';

import type { TimeCoreSceneProps } from '@/components/wakaclock/time-core/time-core-scene';
import type { DurationsResponse } from '@/lib/wakaclock/types';

const api = vi.hoisted(() => ({ getDurations: vi.fn() }));
vi.mock('@/lib/wakaclock/endpoints', () => ({ getDurations: api.getDurations }));

vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'user-1' }),
}));

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('motion/react', async (original) => ({
  ...(await original<typeof import('motion/react')>()),
  useReducedMotion: () => motion.reduced,
}));

// The WebGL scene is replaced by a stub that exposes its props, so the stage's wiring
// (hover, select, explode, focus) is testable without a GPU.
const sceneProps = vi.hoisted(() => ({ current: null as null | TimeCoreSceneProps }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function SceneStub(props: TimeCoreSceneProps) {
      sceneProps.current = props;
      return <div data-testid="scene-stub" data-exploded={props.exploded} />;
    },
}));

const START = new Date(2026, 10, 6).getTime() / 1000;

function day(extra: Partial<DurationsResponse> = {}): DurationsResponse {
  const block = (project: null | string, hour: number, minutes: number) => ({
    category: 'coding',
    duration_seconds: minutes * 60,
    end: START + hour * 3600 + minutes * 60,
    entity: 'x',
    heartbeat_count: 2,
    language: 'Rust',
    project,
    start: START + hour * 3600,
  });
  return {
    data: [block('web', 9, 90), block('api', 14, 30), block(null, 20, 15)],
    date: '2026-11-06',
    range_end: START + 86_400,
    range_start: START,
    total: 0,
    ...extra,
  };
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TimeCore />
    </QueryClientProvider>
  );
}

let getContext: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sceneProps.current = null;
  motion.reduced = false;
  getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TimeCore', () => {
  it('renders the day with the 2D dial when WebGL is unavailable', async () => {
    getContext.mockReturnValue(null);
    api.getDurations.mockResolvedValue(day());
    mount();

    expect(await screen.findByTestId('time-core-total')).toHaveTextContent('2h 15m');
    expect(screen.getByTestId('time-core-dial')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /explode/i })).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Projects on the dial' });
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['01web1h 30m', '02api30m']);
    expect(screen.getByText(/15m outside any project is counted/)).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(api.getDurations).toHaveBeenCalledWith('user-1', todayDateString(), expect.any(String));
  });

  it('wires the 3D scene: explode, inspect on hover and select, focus a ring', async () => {
    getContext.mockReturnValue({} as RenderingContext);
    api.getDurations.mockResolvedValue(
      day({
        active_ai_only_seconds: 600,
        active_coverage: 'measured',
        active_human_only_seconds: 1800,
        active_overlap_seconds: 300,
        active_seconds: 2700,
      })
    );
    mount();

    const stub = await screen.findByTestId('scene-stub');
    expect(screen.getByText('Measured active · who was working')).toBeInTheDocument();
    expect(screen.getByText('45m')).toBeInTheDocument();
    const props = () => sceneProps.current!;
    expect(props().active).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /explode layers/i }));
    expect(stub).toHaveAttribute('data-exploded', 'true');
    expect(screen.getByRole('button', { name: /assemble/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(document.querySelector('[data-anchor="ring:0"]')).toHaveTextContent('web');

    const arc = props().model.rings[0].arcs[0];
    act(() => props().onHover(arc));
    const inspector = screen.getByTestId('time-core-inspector');
    expect(inspector).toHaveTextContent('web');
    expect(inspector).toHaveTextContent('09:00 – 10:30');
    act(() => props().onHover(null));
    expect(inspector).toHaveTextContent('Hover or select a session');

    act(() => props().onSelect(arc));
    expect(props().selectedArcId).toBe(arc.id);
    expect(inspector).toHaveTextContent('1h 30m');
    act(() => props().onSelect(arc));
    expect(props().selectedArcId).toBeNull();

    const api_ = screen.getByRole('button', { name: /api/ });
    fireEvent.mouseEnter(api_);
    expect(props().focusedRing).toBe(1);
    fireEvent.mouseLeave(api_);
    expect(props().focusedRing).toBeNull();
    fireEvent.focus(api_);
    expect(props().focusedRing).toBe(1);
    fireEvent.blur(api_);
    fireEvent.click(api_);
    expect(api_).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(api_);
    expect(api_).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves between days and never past today', async () => {
    getContext.mockReturnValue(null);
    api.getDurations.mockResolvedValue(day());
    mount();
    await screen.findByTestId('time-core-total');

    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    await vi.waitFor(() =>
      expect(api.getDurations).toHaveBeenLastCalledWith('user-1', expected, expect.any(String))
    );
    const next = screen.getByRole('button', { name: 'Next day' });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    await vi.waitFor(() =>
      expect(api.getDurations).toHaveBeenLastCalledWith(
        'user-1',
        todayDateString(),
        expect.any(String)
      )
    );
  });

  it('shows an empty dial for a day with nothing recorded', async () => {
    getContext.mockReturnValue({} as RenderingContext);
    api.getDurations.mockResolvedValue(day({ data: [] }));
    mount();
    expect(await screen.findByText('No recorded activity on this day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explode layers/i })).toBeDisabled();
    expect(screen.queryByRole('list', { name: 'Projects on the dial' })).not.toBeInTheDocument();
  });

  it('treats a throwing canvas as no WebGL and respects reduced motion', async () => {
    motion.reduced = true;
    getContext.mockImplementation(() => {
      throw new Error('blocked');
    });
    api.getDurations.mockResolvedValue(day());
    mount();
    expect(await screen.findByTestId('time-core-dial')).toBeInTheDocument();
  });

  it('hides a measured split with no seconds in it', async () => {
    getContext.mockReturnValue(null);
    api.getDurations.mockResolvedValue(
      day({
        active_ai_only_seconds: 0,
        active_coverage: 'measured',
        active_human_only_seconds: 0,
        active_overlap_seconds: 0,
      })
    );
    mount();
    await screen.findByTestId('time-core-total');
    expect(screen.queryByText('Measured active · who was working')).not.toBeInTheDocument();
  });
});
