'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/dashboard/wakaclock/analytics/timeline', label: 'Activity Timeline' },
  { href: '/dashboard/wakaclock/analytics/human-ai', label: 'Human vs AI' },
  { href: '/dashboard/wakaclock/analytics/projects', label: 'Projects' },
  { href: '/dashboard/wakaclock/analytics/heatmap', label: 'Activity Heatmap' },
  { href: '/dashboard/wakaclock/analytics/trust', label: 'Measurement Trust' },
] as const;

/**
 * Sibling analytics views as a segmented control in the page toolbar. The selected
 * segment's surface glides between items; links keep the current filters in the URL.
 */
export function AnalyticsNav({ href }: { href: (path: string) => string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Analytics sections" className="no-scrollbar -mx-1 overflow-x-auto px-1">
      <div className="bg-muted inline-flex min-w-max gap-0.5 rounded-lg p-0.5 shadow-[inset_0_0_0_1px_var(--border)]">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href.endsWith('/projects') && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              href={href(item.href)}
              key={item.href}
            >
              {active && (
                <motion.span
                  aria-hidden
                  className="bg-card absolute inset-0 rounded-md shadow-sm"
                  layoutId="analytics-section-indicator"
                  transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }}
                />
              )}
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
