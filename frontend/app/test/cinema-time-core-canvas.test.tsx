import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TimeCoreScene from '@/components/wakaclock/time-core/time-core-scene';
import { buildTimeCore } from '@/lib/wakaclock/time-core';

// jsdom has no WebGL: the Canvas becomes a probe that records the props the wrapper picks.
const canvas = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock('@react-three/fiber', async (original) => ({
  ...(await original<typeof import('@react-three/fiber')>()),
  Canvas: (props: Record<string, unknown>) => {
    canvas.props = props;
    return <div data-frameloop={String(props.frameloop)} data-testid="canvas" />;
  },
}));
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }));

const model = buildTimeCore({ data: [], date: '2026-11-06', total: 0 });

function mediaQuery(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    matches,
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.spyOn(window, 'matchMedia').mockReturnValue(query as unknown as MediaQueryList);
  return {
    fire: (next: boolean) => ((query.matches = next), listeners.forEach((fn) => fn())),
    listeners,
  };
}

describe('TimeCoreScene canvas', () => {
  it('animates only while active and lowers resolution on small screens', () => {
    const media = mediaQuery(false);
    const onHover = vi.fn();
    const { rerender, unmount } = render(
      <TimeCoreScene
        active
        exploded={false}
        focusedRing={null}
        model={model}
        onHover={onHover}
        onSelect={vi.fn()}
        overlay={{ current: null }}
        reducedMotion={false}
        selectedArcId={null}
      />
    );
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'always');
    expect(canvas.props?.dpr).toEqual([1, 1.75]);
    act(() => media.fire(true));
    expect(canvas.props?.dpr).toEqual([1, 1.5]);
    (canvas.props?.onPointerMissed as () => void)();
    expect(onHover).toHaveBeenCalledWith(null);

    rerender(
      <TimeCoreScene
        active={false}
        exploded={false}
        focusedRing={null}
        model={model}
        onHover={onHover}
        onSelect={vi.fn()}
        overlay={{ current: null }}
        reducedMotion
        selectedArcId={null}
      />
    );
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'demand');
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
