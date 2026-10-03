'use client';

import * as React from 'react';

import { setCurrentToken, setUnauthorizedHandler } from './session';

const STORAGE_KEY = 'wakaclock-session';

/**
 * True if `token` is missing, malformed, or past its `exp` claim.
 *
 * Without this check, hydration trusts whatever is in localStorage: a signed-in visitor
 * whose 24h token has since expired gets bounced from /login to /dashboard (because
 * `userId` is present) and then straight back to /login a moment later (because every
 * request the dashboard fires 401s and `notifyUnauthorized` clears the session) — a
 * visible flash of dashboard content on what should have been a quiet render of the sign-in
 * form. Checking `exp` locally, before anything renders on that assumption, skips the round
 * trip for the common case. A token rejected for another reason (rotated secret, revoked
 * server-side) still recovers via `notifyUnauthorized`, just with that same flash.
 */
function isTokenExpired(token: string): boolean {
  const payload = token.split('.')[1];
  if (!payload) return true;

  try {
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/');
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    const { exp } = JSON.parse(json) as { exp?: number };
    return typeof exp !== 'number' || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/**
 * Session state after POST /auth/register or /auth/login — replaces the earlier
 * "type any uuid" identity model. `token` is a short-lived (24h) JWT the axios
 * interceptor in client.ts attaches as `Authorization: Bearer` on every request; the
 * backend resolves `user_id` from that token, ignoring whatever a caller might also put
 * in a query param.
 *
 * Zustand is forbidden in this repo (see eslint.config.mjs no-restricted-imports),
 * so this is Context + useReducer instead.
 */
export interface WakaclockUserState {
  /** False until the stored session has been read; `userId` is not meaningful before it. */
  hydrated: boolean;
  logout: () => void;
  setSession: (session: { token: string; userId: string; username: string }) => void;
  token: null | string;
  userId: null | string;
  username: null | string;
}

interface StoredShape {
  token: null | string;
  userId: null | string;
  username: null | string;
}

type Action = { token: string; type: 'set'; userId: string; username: string } | { type: 'clear' };

function reducer(state: StoredShape, action: Action): StoredShape {
  switch (action.type) {
    case 'set': {
      return { userId: action.userId, username: action.username, token: action.token };
    }
    case 'clear': {
      return { userId: null, username: null, token: null };
    }
    default: {
      return state;
    }
  }
}

const WakaclockUserContext = React.createContext<null | WakaclockUserState>(null);

export function WakaclockUserProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, {
    userId: null,
    username: null,
    token: null,
  });
  const hydrated = React.useRef(false);
  /*
   * Exposed as state, not just the ref above, because consumers have to be able to tell
   * "no session" apart from "the session has not been read out of localStorage yet". They
   * look identical on the first render, and a gate that cannot tell them apart bounces a
   * logged-in visitor to the login page every time they open the app.
   */
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredShape;
        if (parsed.userId && parsed.token && parsed.username && !isTokenExpired(parsed.token)) {
          dispatch({
            type: 'set',
            userId: parsed.userId,
            username: parsed.username,
            token: parsed.token,
          });
        }
      }
    } catch {
      // ignore malformed localStorage state
    } finally {
      hydrated.current = true;
      setIsHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    setCurrentToken(state.token);
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage may be unavailable in restricted browser contexts. The in-memory
      // session and authorization token still follow login/logout immediately.
    }
  }, [state]);

  // Let the axios interceptor end the session when the server rejects our token.
  React.useEffect(() => {
    setUnauthorizedHandler(() => dispatch({ type: 'clear' }));
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = React.useMemo<WakaclockUserState>(
    () => ({
      hydrated: isHydrated,
      userId: state.userId,
      username: state.username,
      token: state.token,
      setSession: (session) =>
        dispatch({
          type: 'set',
          userId: session.userId,
          username: session.username,
          token: session.token,
        }),
      logout: () => dispatch({ type: 'clear' }),
    }),
    [isHydrated, state]
  );

  return <WakaclockUserContext.Provider value={value}>{children}</WakaclockUserContext.Provider>;
}

/** Selector-style access, e.g. `useWakaclockUserStore((s) => s.userId)`. */
export function useWakaclockUserStore<T>(selector: (state: WakaclockUserState) => T): T {
  const ctx = React.useContext(WakaclockUserContext);
  if (!ctx) {
    throw new Error('useWakaclockUserStore must be used within a WakaclockUserProvider');
  }
  return selector(ctx);
}
