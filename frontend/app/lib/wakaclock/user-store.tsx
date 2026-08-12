'use client';

import * as React from 'react';

import { setCurrentToken, setUnauthorizedHandler } from './session';

const STORAGE_KEY = 'wakaclock-session';

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

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredShape;
        if (parsed.userId && parsed.token && parsed.username) {
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
    }
  }, []);

  React.useEffect(() => {
    setCurrentToken(state.token);
    if (!hydrated.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Let the axios interceptor end the session when the server rejects our token.
  React.useEffect(() => {
    setUnauthorizedHandler(() => dispatch({ type: 'clear' }));
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = React.useMemo<WakaclockUserState>(
    () => ({
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
    [state]
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
