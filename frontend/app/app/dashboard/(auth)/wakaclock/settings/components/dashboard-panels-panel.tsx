'use client';

import Link from 'next/link';

import { useDashboardPanels } from '@/components/dashboard-panels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  DASHBOARD_PANEL_PAGES,
  DASHBOARD_PANELS,
  panelsForPage,
  parentPanelOf,
} from '@/lib/dashboard-panels';
import { cn } from '@/lib/utils';

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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Panels and charts</CardTitle>
            <CardDescription>
              Turn off anything you do not read. Hidden panels are not rendered at all, so their
              data is never requested either. Saved on this device.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hiddenCount > 0 ? (
              <Badge data-testid="dashboard-panels-hidden-count" variant="secondary">
                {hiddenCount} hidden
              </Badge>
            ) : null}
            <Button
              disabled={hiddenCount === 0}
              onClick={reset}
              size="sm"
              type="button"
              variant="outline"
            >
              Show all
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {DASHBOARD_PANEL_PAGES.map((page) => (
          <section aria-labelledby={`panels-${page.id}`} key={page.id}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold" id={`panels-${page.id}`}>
                {page.title}
              </h3>
              <Link
                className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
                href={page.href}
              >
                Open page
              </Link>
            </div>
            <ul className="divide-border divide-y rounded-md border">
              {panelsForPage(page.id).map((panel) => {
                const parent = parentPanelOf(panel.id);
                // A child of a panel that is switched off cannot show either, so its own
                // switch would be an enabled control that does nothing when clicked.
                const blockedByParent = parent !== undefined && !isVisible(parent);

                return (
                  <li
                    className={cn(
                      'flex items-start justify-between gap-4 p-4',
                      parent !== undefined && 'pl-10'
                    )}
                    key={panel.id}
                  >
                    <div className="min-w-0">
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
                      checked={isVisible(panel.id) && !blockedByParent}
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
      </CardContent>
    </Card>
  );
}
