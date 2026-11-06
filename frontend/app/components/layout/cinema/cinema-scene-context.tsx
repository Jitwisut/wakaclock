'use client';

import * as React from 'react';

import type { CinemaScene } from './cinema-nav';

/**
 * The scene the Cinema shell has resolved for the current route, shared with page
 * openers so they print the same number as the rail. Null outside the shell.
 */
const CinemaSceneContext = React.createContext<CinemaScene | null>(null);

export const CinemaSceneProvider = CinemaSceneContext.Provider;

export function useCinemaScene(): CinemaScene | null {
  return React.useContext(CinemaSceneContext);
}
