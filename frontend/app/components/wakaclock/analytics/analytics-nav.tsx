'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/dashboard/wakaclock/analytics/timeline', label: 'Activity Timeline' },
  { href: '/dashboard/wakaclock/analytics/human-ai', label: 'Human vs AI' },
  { href: '/dashboard/wakaclock/analytics/projects', label: 'Projects' },
  { href: '/dashboard/wakaclock/analytics/heatmap', label: 'Activity Heatmap' },
  { href: '/dashboard/wakaclock/analytics/trust', label: 'Measurement Trust' },
] as const;

export function AnalyticsNav({ href }: { href: (path: string) => string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Analytics sections" className="overflow-x-auto">
      <div className="bg-muted/30 flex min-w-max gap-1 rounded-lg border p-1">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href.endsWith('/projects') && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'bg-background text-foreground rounded-md px-3 py-2 text-sm font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium'
              }
              href={href(item.href)}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
