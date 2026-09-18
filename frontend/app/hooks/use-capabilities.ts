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
  // Selecting the fields callers need, rather than spreading the query result, keeps
  // this hook's public surface focused on deployment capabilities.
  const { data, isLoading } = useQuery({
    queryFn: getCapabilities,
    queryKey: wakaclockKeys.capabilities(),
    staleTime: 30 * 60 * 1000,
  });

  // The server's feature matrix is the source of truth for capabilities that can
  // still be fail-closed even when their storage dependency is configured. For
  // example, private leaderboards have routes and PostgreSQL tables but are not
  // enabled until their complete runtime contract is ready.
  const featureAvailability = data
    ? Object.fromEntries(
        (data.features ?? []).map((feature) => [feature.key, feature.available === true])
      )
    : undefined;

  return {
    isLoading,
    /**
     * Undefined while loading — callers should treat that as "not yet known" and render
     * a skeleton rather than flashing an unavailable notice at every page load.
     */
    postgresEnabled: data?.postgres_enabled,
    presenceV2Available: data?.presence_v2_available,
    featureAvailability,
  };
}
