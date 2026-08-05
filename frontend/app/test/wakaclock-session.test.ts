import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCurrentToken,
  notifyUnauthorized,
  setCurrentToken,
  setUnauthorizedHandler,
} from '@/lib/wakaclock/session';

describe('wakaclock session bridge', () => {
  beforeEach(() => {
    setCurrentToken(null);
    setUnauthorizedHandler(null);
  });

  it('round-trips the token for the axios request interceptor', () => {
    expect(getCurrentToken()).toBeNull();
    setCurrentToken('abc123');
    expect(getCurrentToken()).toBe('abc123');
  });

  it('invokes the registered handler when the server rejects a token', () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    notifyUnauthorized();

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no handler is registered', () => {
    // Guards the unmounted-provider case — a late 401 landing after teardown must not
    // throw, since there's no session left to end.
    expect(() => notifyUnauthorized()).not.toThrow();
  });

  it('stops notifying after the handler is unregistered', () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setUnauthorizedHandler(null);

    notifyUnauthorized();

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
