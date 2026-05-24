import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
    writable: true,
  });
}

type MockMql = {
  addEventListener: (event: string, listener: () => void) => void;
  dispatchEvent: () => boolean;
  removeEventListener: (event: string, listener: () => void) => void;
};

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
    writable: true,
  });
});

it('useIsMobile updates when the media query changes', async () => {
  let mql: MockMql | undefined;
  const listeners = new Set<() => void>();

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => {
      const instance: MockMql = {
        addEventListener: vi.fn((event: string, listener: () => void) => {
          if (event !== 'change') return;

          listeners.add(listener);
        }),
        removeEventListener: vi.fn((event: string, listener: () => void) => {
          if (event !== 'change') return;

          listeners.delete(listener);
        }),
        dispatchEvent: vi.fn(() => {
          for (const listener of listeners) {
            listener();
          }

          return true;
        }) as unknown as () => boolean,
      };

      mql = instance;

      return {
        matches: false,
        media: query,
        onchange: null,
        ...instance,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      };
    }),
    writable: true,
  });

  setViewportWidth(1024);

  const { result, unmount } = renderHook(() => useIsMobile());

  await waitFor(() => expect(result.current).toBe(false));

  setViewportWidth(500);
  act(() => {
    mql?.dispatchEvent();
  });

  await waitFor(() => expect(result.current).toBe(true));

  unmount();

  expect(mql?.removeEventListener).toHaveBeenCalled();
});

it('useIsTablet updates when the media query changes', async () => {
  let mql: MockMql | undefined;
  const listeners = new Set<() => void>();

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => {
      const instance: MockMql = {
        addEventListener: vi.fn((event: string, listener: () => void) => {
          if (event !== 'change') return;

          listeners.add(listener);
        }),
        removeEventListener: vi.fn((event: string, listener: () => void) => {
          if (event !== 'change') return;

          listeners.delete(listener);
        }),
        dispatchEvent: vi.fn(() => {
          for (const listener of listeners) {
            listener();
          }

          return true;
        }) as unknown as () => boolean,
      };

      mql = instance;

      return {
        matches: false,
        media: query,
        onchange: null,
        ...instance,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      };
    }),
    writable: true,
  });

  setViewportWidth(1400);

  const { result, unmount } = renderHook(() => useIsTablet());

  await waitFor(() => expect(result.current).toBe(false));

  setViewportWidth(900);
  act(() => {
    mql?.dispatchEvent();
  });

  await waitFor(() => expect(result.current).toBe(true));

  unmount();

  expect(mql?.removeEventListener).toHaveBeenCalled();
});
