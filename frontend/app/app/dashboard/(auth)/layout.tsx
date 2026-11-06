import type React from 'react';

import { cookies } from 'next/headers';

import { DashboardShell } from '@/components/layout/dashboard-shell';

import type { Metadata } from 'next';

/**
 * Every route below this layout renders one developer's own activity — project
 * names, file paths, AI agent usage. It must never be indexed, independently of
 * robots.txt, which is only a crawl directive and not an indexing guarantee.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen =
    cookieStore.get('sidebar_state')?.value === 'true' ||
    cookieStore.get('sidebar_state') === undefined;

  return <DashboardShell defaultOpen={defaultOpen}>{children}</DashboardShell>;
}
