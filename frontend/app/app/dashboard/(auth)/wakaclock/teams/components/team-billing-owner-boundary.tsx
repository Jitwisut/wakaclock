'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

interface Boundary {
  error: unknown;
  reload: (read: () => Promise<{ isSuccess: boolean }>) => Promise<void>;
  report: (error: unknown) => void;
  revision: number;
}
const Context = createContext<Boundary | null>(null);

/** Scope this provider by account/organization. A success in another background
 * request cannot clear a denial; only the explicit unchanged reload can do so. */
export function TeamBillingOwnerBoundary({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ error: unknown; revision: number }>({
    error: null,
    revision: 0,
  });
  const epoch = useRef(0);
  const report = useCallback((error: unknown) => {
    epoch.current += 1;
    setState((old) => ({ error, revision: old.revision + 1 }));
  }, []);
  const reload = useCallback(async (read: () => Promise<{ isSuccess: boolean }>) => {
    const before = epoch.current;
    const result = await read();
    if (result.isSuccess && before === epoch.current) {
      setState((old) => ({ error: null, revision: old.revision + 1 }));
    }
  }, []);
  const value = useMemo(() => ({ ...state, report, reload }), [state, report, reload]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useOptionalTeamBillingOwnerBoundary() {
  return useContext(Context);
}
export function useTeamBillingOwnerBoundary() {
  const value = useOptionalTeamBillingOwnerBoundary();
  if (!value) throw new Error('Billing Owner boundary missing');
  return value;
}
