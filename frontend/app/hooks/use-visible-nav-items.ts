'use client';

import * as React from 'react';

import { type NavGroup, navItems } from '@/components/layout/sidebar/nav-main';
import { useCapabilities } from '@/hooks/use-capabilities';

/**
 * Navigation filtered to what this deployment can actually serve.
 *
 * Shared by the sidebar and the command palette on purpose. Filtering in only one of
 * them means a ClickHouse-only install hides Goals from the sidebar and then offers it
 * in search — the same dead end, one keystroke further away.
 *
 * While capabilities are unknown the Postgres-only entries stay hidden rather than
 * appearing and then vanishing, which is the more jarring of the two flickers.
 */
export function useVisibleNavItems(items: NavGroup[] = navItems): NavGroup[] {
  const { postgresEnabled } = useCapabilities();

  return React.useMemo(
    () =>
      items
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.requiresPostgres || postgresEnabled === true
          ),
        }))
        .filter((group) => group.items.length > 0),
    [items, postgresEnabled]
  );
}
