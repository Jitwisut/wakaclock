'use client';

import * as React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navItems } from '@/components/layout/sidebar/nav-items';

type Crumb = { href: string; title: string };

/** Longest matching nav entry wins, so `/analytics/projects/x` resolves to Projects. */
export function breadcrumbFor(pathname: string): Crumb[] {
  let best: Crumb[] = [];
  let bestLength = -1;
  const consider = (trail: Crumb[], href: string) => {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && href.length > bestLength) {
      best = trail;
      bestLength = href.length;
    }
  };
  for (const group of navItems) {
    for (const item of group.items) {
      consider([{ href: item.href, title: item.title }], item.href);
      for (const sub of item.items ?? []) {
        consider(
          [
            { href: item.href, title: item.title },
            { href: sub.href, title: sub.title },
          ],
          sub.href
        );
      }
    }
  }
  return best;
}

/**
 * Where you are, in the toolbar: the section and, inside Analytics, the view. The last
 * crumb is the current page; earlier ones link back up. Hidden on narrow screens, where
 * the page title already says the same thing.
 */
export function ToolbarBreadcrumb() {
  const pathname = usePathname();
  const trail = React.useMemo(() => breadcrumbFor(pathname), [pathname]);
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 lg:block" data-slot="toolbar-breadcrumb">
      <ol className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li className="flex min-w-0 items-center gap-1.5" key={crumb.href}>
              {index > 0 && <span aria-hidden>/</span>}
              {last ? (
                <span aria-current="page" className="text-foreground truncate font-medium">
                  {crumb.title}
                </span>
              ) : (
                <Link
                  className="hover:text-foreground truncate transition-colors"
                  href={crumb.href}
                >
                  {crumb.title}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
