import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { HeroAtmosphere } from '@/components/marketing/hero-atmosphere';
import { QUALITY_TIERS } from '@/components/marketing/time/time-quality';

const scene = vi.hoisted(() => ({
  create: vi.fn(),
  dispose: vi.fn(),
}));
const quality = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('@/components/marketing/hero-atmosphere-scene', () => ({
  createAtmosphere: (...args: unknown[]) => {
    scene.create(...args);
    return { dispose: scene.dispose };
  },
}));

vi.mock('@/components/marketing/time/time-quality', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/marketing/time/time-quality')>();
  return {
    ...actual,
    chooseTimeQuality: () => quality.value,
    readDeviceSignals: () => ({}),
  };
});

const flushImport = () => act(async () => {});

function setReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { configurable: true, value });
}

beforeEach(() => {
  scene.create.mockReset();
  scene.dispose.mockReset();
  quality.value = QUALITY_TIERS.full;
  setReadyState('complete');
});

afterEach(() => {
  // Unmount while the idle-callback stubs still exist.
  cleanup();
  vi.useRealTimers();
  // @ts-expect-error -- removed again after the idle-callback tests
  delete window.requestIdleCallback;
  // @ts-expect-error -- removed again after the idle-callback tests
  delete window.cancelIdleCallback;
});

it('renders a decorative host and nothing more when the device gets no scene', async () => {
  quality.value = null;
  const { container } = render(<HeroAtmosphere />);
  const host = container.querySelector('.mkt-hero-atmosphere') as HTMLElement;
  expect(host.getAttribute('aria-hidden')).toBe('true');
  await flushImport();
  expect(scene.create).not.toHaveBeenCalled();
});

it('mounts the scene once the page is idle, sized to the device tier, and disposes it', async () => {
  vi.useFakeTimers();
  const { container, unmount } = render(<HeroAtmosphere />);
  const host = container.querySelector('.mkt-hero-atmosphere') as HTMLElement;
  expect(scene.create).not.toHaveBeenCalled();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(scene.create).toHaveBeenCalledWith(host, { count: 900, maxDpr: 1.5, pointer: true });
  expect(host.dataset.ready).toBe('true');
  unmount();
  expect(scene.dispose).toHaveBeenCalledOnce();
  expect(host.dataset.ready).toBeUndefined();
});

it.each([
  ['low', { count: 520, maxDpr: 1.25, pointer: true }],
  ['compact', { count: 260, maxDpr: 1.25, pointer: false }],
] as const)('uses a lighter field on %s devices', async (tier, expected) => {
  quality.value = QUALITY_TIERS[tier];
  const idle = vi.fn((callback: () => void) => {
    callback();
    return 7;
  });
  window.requestIdleCallback = idle as unknown as typeof window.requestIdleCallback;
  window.cancelIdleCallback = vi.fn();
  render(<HeroAtmosphere />);
  await flushImport();
  expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
  expect(scene.create).toHaveBeenCalledWith(expect.any(HTMLElement), expected);
});

it('waits for the load event, and cancels a pending idle callback on unmount', () => {
  setReadyState('loading');
  window.requestIdleCallback = vi.fn(() => 3) as unknown as typeof window.requestIdleCallback;
  const cancelIdle = vi.fn();
  window.cancelIdleCallback = cancelIdle;
  const { unmount } = render(<HeroAtmosphere />);
  expect(window.requestIdleCallback).not.toHaveBeenCalled();
  act(() => {
    window.dispatchEvent(new Event('load'));
  });
  expect(window.requestIdleCallback).toHaveBeenCalledOnce();
  unmount();
  expect(cancelIdle).toHaveBeenCalledWith(3);
});

it('unmounts cleanly before the page has loaded', () => {
  setReadyState('loading');
  const remove = vi.spyOn(window, 'removeEventListener');
  const { unmount } = render(<HeroAtmosphere />);
  unmount();
  expect(remove).toHaveBeenCalledWith('load', expect.any(Function));
  expect(scene.create).not.toHaveBeenCalled();
});

it('cancels the fallback timer, and never mounts a scene whose import lands after unmount', async () => {
  vi.useFakeTimers();
  const clear = vi.spyOn(globalThis, 'clearTimeout');
  const first = render(<HeroAtmosphere />);
  first.unmount();
  expect(clear).toHaveBeenCalled();

  const second = render(<HeroAtmosphere />);
  // Fire the idle timer, then unmount while the dynamic import is still resolving.
  act(() => {
    vi.advanceTimersByTime(600);
  });
  second.unmount();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(scene.create).not.toHaveBeenCalled();
  expect(scene.dispose).not.toHaveBeenCalled();
});
