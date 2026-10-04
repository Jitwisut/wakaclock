'use client';

import { ArrowUpRightIcon, LayoutDashboardIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

import { useDashboardPanels } from '@/components/dashboard-panels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  DASHBOARD_PANEL_PAGES,
  DASHBOARD_PANELS,
  panelsForPage,
  parentPanelOf,
} from '@/lib/dashboard-panels';
import { cn } from '@/lib/utils';

import { Surface, SurfaceHeader } from './surface';

/**
 * Chooses which panels and charts the dashboard draws.
 *
 * The preference is per device, stored in a cookie next to the theme, and applies to every
 * dashboard page rather than only the one you happen to be on — a chart you never read is
 * a chart you never want to see load, wherever it lives.
 */
export function DashboardPanelsPanel() {
  const { hidden, isVisible, reset, setVisible } = useDashboardPanels();
  const hiddenCount = DASHBOARD_PANELS.filter((panel) => hidden.has(panel.id)).length;

  const visibleCount = DASHBOARD_PANELS.length - hiddenCount;

  return (
    <Surface>
      <SurfaceHeader
        actions={
          <>
            {/* No exit animation: the count must leave the DOM as soon as nothing is hidden. */}
            {hiddenCount > 0 ? (
              <motion.span animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.9 }}>
                <Badge
                  className="rounded-full"
                  data-testid="dashboard-panels-hidden-count"
                  variant="secondary"
                >
                  {hiddenCount} hidden
                </Badge>
              </motion.span>
            ) : null}
            <Button
              className="rounded-full"
              disabled={hiddenCount === 0}
              onClick={reset}
              size="sm"
              type="button"
              variant="outline"
            >
              Show all
            </Button>
          </>
        }
        description="Hidden panels are not rendered at all, so their data is never requested either. Saved on this device."
        icon={LayoutDashboardIcon}
        title="Panels and charts"
      />

      <div className="px-5 sm:px-6">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Visible on this device</span>
          <span className="font-mono tabular-nums">
            {visibleCount}/{DASHBOARD_PANELS.length}
          </span>
        </div>
        <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
          <motion.div
            animate={{ scaleX: visibleCount / DASHBOARD_PANELS.length }}
            className="h-full origin-left rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
            initial={false}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 xl:grid-cols-2">
        {DASHBOARD_PANEL_PAGES.map((page) => (
          <section
            aria-labelledby={`panels-${page.id}`}
            className="bg-muted/25 rounded-xl border"
            key={page.id}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h3 className="text-sm font-semibold" id={`panels-${page.id}`}>
                {page.title}
              </h3>
              <Link
                className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                href={page.href}
              >
                Open page
                <ArrowUpRightIcon
                  aria-hidden="true"
                  className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            </div>
            <ul className="divide-border/70 divide-y">
              {panelsForPage(page.id).map((panel) => {
                const parent = parentPanelOf(panel.id);
                // A child of a panel that is switched off cannot show either, so its own
                // switch would be an enabled control that does nothing when clicked.
                const blockedByParent = parent !== undefined && !isVisible(parent);
                const on = isVisible(panel.id) && !blockedByParent;

                return (
                  <li
                    className={cn(
                      'hover:bg-background/60 relative flex items-start justify-between gap-4 px-4 py-3.5 transition-colors',
                      parent !== undefined && 'pl-10'
                    )}
                    key={panel.id}
                  >
                    {parent !== undefined && (
                      <span
                        aria-hidden="true"
                        className="border-border absolute top-0 left-5 h-1/2 w-3 rounded-bl-md border-b border-l"
                      />
                    )}
                    <div className={cn('min-w-0 transition-opacity', !on && 'opacity-70')}>
                      <Label
                        className={cn('text-sm', blockedByParent ? 'opacity-60' : 'cursor-pointer')}
                        htmlFor={`panel-${panel.id}`}
                      >
                        {panel.label}
                      </Label>
                      <p
                        className="text-muted-foreground mt-1 text-xs"
                        id={`panel-desc-${panel.id}`}
                      >
                        {blockedByParent
                          ? 'Hidden because the panel that contains it is switched off.'
                          : panel.description}
                      </p>
                    </div>
                    <Switch
                      aria-describedby={`panel-desc-${panel.id}`}
                      checked={on}
                      className="mt-0.5 shrink-0"
                      data-testid={`panel-switch-${panel.id}`}
                      disabled={blockedByParent}
                      id={`panel-${panel.id}`}
                      onCheckedChange={(checked) => setVisible(panel.id, checked)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Surface>
  );
}
