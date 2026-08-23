'use client';

import { useQuery } from '@tanstack/react-query';

import { getCapabilities } from '@/lib/wakaclock/endpoints-v2';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

/**
 * What this deployment can actually do.
 *
 * Goals, leaderboards, share links and exports all live in Postgres, and the server runs
 * happily without it in ClickHouse-only mode — so those endpoints are not "broken" when
 * they are unavailable, they are simply not part of that install. Asking the server
 * rather than assuming keeps a self-hosted deployment from being shown menu items that
 * lead nowhere.
 *
 * Deliberately not gated on a signed-in user: `/capabilities` describes the server, not
 * the account, and the answer does not change while the tab is open.
 */
export function useCapabilities() {
  // Selecting the two fields callers need, rather than spreading the query result, keeps
  // this from subscribing to every internal query state change.
  const { data, isLoading } = useQuery({
    queryFn: getCapabilities,
    queryKey: wakaclockKeys.capabilities(),
    staleTime: 30 * 60 * 1000,
  });

  return {
    isLoading,
    /**
     * Undefined while loading — callers should treat that as "not yet known" and render
     * a skeleton rather than flashing an unavailable notice at every page load.
     */
    postgresEnabled: data?.postgres_enabled,
  };
}
