'use client';

import * as React from 'react';

import { getCurrentToken, setCurrentToken, setUnauthorizedHandler } from './session';

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

function reducer(_state: StoredShape, action: Action): StoredShape {
  if (action.type === 'set') {
    return { userId: action.userId, username: action.username, token: action.token };
  }
  return { userId: null, username: null, token: null };
}

const WakaclockUserContext = React.createContext<null | WakaclockUserState>(null);

export function WakaclockUserProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, {
    userId: null,
    username: null,
    token: null,
  });
  /*
   * Exposed as state because consumers have to be able to tell
   * "no session" apart from "the session has not been read out of localStorage yet". They
   * look identical on the first render, and a gate that cannot tell them apart bounces a
   * logged-in visitor to the login page every time they open the app.
   */
  const [isHydrated, setIsHydrated] = React.useState(false);

  const applySession = React.useCallback((session: null | StoredShape) => {
    setCurrentToken(session?.token ?? null);
    if (session?.userId && session.token && session.username) {
      dispatch({
        type: 'set',
        userId: session.userId,
        username: session.username,
        token: session.token,
      });
    } else {
      dispatch({ type: 'clear' });
    }
  }, []);

  const saveSession = React.useCallback(
    (session: null | StoredShape) => {
      applySession(session);
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(session ?? { userId: null, token: null, username: null })
        );
      } catch {
        // Storage may be disabled. The in-memory session is already current.
      }
    },
    [applySession]
  );

  React.useEffect(() => {
    function restore() {
      let stored: null | StoredShape = null;
      try {
        const parsed = JSON.parse(
          window.localStorage.getItem(STORAGE_KEY) ?? 'null'
        ) as null | StoredShape;
        if (parsed?.userId && parsed.username && parsed.token && !isTokenExpired(parsed.token)) {
          stored = parsed;
        }
      } catch {
        // Treat unreadable or malformed storage as anonymous.
      }
      applySession(stored);
    }
    restore();
    setIsHydrated(true);
    // Read current storage so queued events cannot replay an earlier session.
    function onStorage(event: { key: null | string }) {
      if (event.key === STORAGE_KEY || event.key === null) restore();
    }
    window.addEventListener('storage', onStorage);
    setUnauthorizedHandler(() => {
      // Another tab may have signed in before its storage event was delivered.
      try {
        const saved = JSON.parse(
          window.localStorage.getItem(STORAGE_KEY) ?? 'null'
        ) as null | StoredShape;
        if (saved?.token && saved.token !== getCurrentToken()) {
          restore();
          return;
        }
      } catch {
        // A rejected in-memory credential must still expire.
      }
      saveSession(null);
    });
    return () => {
      window.removeEventListener('storage', onStorage);
      setUnauthorizedHandler(null);
    };
  }, [applySession, saveSession]);

  const value = React.useMemo<WakaclockUserState>(
    () => ({
      hydrated: isHydrated,
      userId: state.userId,
      username: state.username,
      token: state.token,
      setSession: saveSession,
      logout: () => saveSession(null),
    }),
    [isHydrated, state, saveSession]
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
