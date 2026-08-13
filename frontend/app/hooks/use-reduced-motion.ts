'use client';

import * as React from 'react';

/**
 * Tracks `prefers-reduced-motion`. Starts `false` (not `matches` from a server-side
 * guess) so SSR/hydration never disagrees with the client's first paint; the effect
 * corrects it immediately after mount, before the user can perceive a flash of motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
