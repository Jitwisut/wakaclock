import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
it('responds to OS motion preference changes and removes the exact listener on unmount', () => {
  let listener!: (event: MediaQueryListEvent) => void;
  const remove = vi.fn();
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    addEventListener: (_: string, callback: typeof listener) => {
      listener = callback;
    },
    removeEventListener: remove,
  } as unknown as MediaQueryList);
  const view = renderHook(() => useReducedMotion());
  expect(view.result.current).toBe(true);
  act(() => listener({ matches: false } as MediaQueryListEvent));
  expect(view.result.current).toBe(false);
  view.unmount();
  expect(remove).toHaveBeenCalledWith('change', listener);
  media.mockRestore();
});
