'use client';

import * as React from 'react';

import { SlidersHorizontalIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/*
 * Workspace layout primitives shared by the dashboard pages. They carry composition only:
 * colour, radius, elevation and motion come from the active theme preset through the
 * shadcn primitives they are built on.
 */

const COLUMN_CLASS: Record<number, string> = {
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

export interface Metric {
  /** Optional context under the value (unit, comparison, coverage). */
  hint?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

/**
 * Key figures as one continuous strip divided by hairlines, instead of a row of separate
 * cards. Wraps to two or three columns on narrow screens.
 */
export function MetricStrip({
  'aria-label': ariaLabel,
  className,
  metrics,
}: {
  'aria-label'?: string;
  className?: string;
  metrics: Metric[];
}) {
  const columns = COLUMN_CLASS[Math.min(Math.max(metrics.length, 3), 6)];
  return (
    <Card className={cn('gap-0 overflow-hidden py-0', className)} data-slot="metric-strip">
      <dl
        aria-label={ariaLabel}
        className={cn('bg-border grid grid-cols-2 gap-px sm:grid-cols-3', columns)}
      >
        {metrics.map((metric) => (
          <div className="bg-card flex min-w-0 flex-col gap-1 px-4 py-3.5" key={metric.label}>
            <dt className="text-muted-foreground truncate text-xs">{metric.label}</dt>
            <dd className="text-lg leading-tight font-semibold tracking-tight tabular-nums">
              {metric.value}
            </dd>
            {metric.hint && (
              <dd className="text-muted-foreground truncate text-xs">{metric.hint}</dd>
            )}
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * Joins a row of existing `StatTile`s into one divided strip, matching `MetricStrip`
 * for pages that keep their tiles' tooltips and loading states. Set the column count
 * on the className.
 */
export function MetricGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-border grid gap-px overflow-hidden rounded-xl border [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none',
        className
      )}
      data-slot="metric-group"
    >
      {children}
    </div>
  );
}

/**
 * A bento cell: a titled surface whose size the parent grid decides. `action` sits at the
 * top right (a link, a segmented toggle).
 */
export function Widget({
  action,
  children,
  className,
  description,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <Card className={cn('min-w-0 gap-3 px-4 py-4 sm:px-5', className)} data-slot="widget">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {action}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </Card>
  );
}

/**
 * Main canvas beside a right-hand inspector. From `xl` the inspector is a sticky column;
 * below it the inspector opens as a sheet from a toolbar button, so the canvas keeps the
 * full width on laptops, tablets and phones.
 */
export function InspectorLayout({
  activeCount = 0,
  children,
  inspector,
  inspectorDescription,
  inspectorTitle,
}: {
  /** How many inspector controls are not at their default, shown on the sheet trigger. */
  activeCount?: number;
  children: React.ReactNode;
  inspector: React.ReactNode;
  inspectorDescription?: string;
  inspectorTitle: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div
      className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_288px]"
      data-slot="inspector-layout"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex justify-end xl:hidden">
          <Sheet onOpenChange={setOpen} open={open}>
            <SheetTrigger asChild>
              <Button size="sm" type="button" variant="outline">
                <SlidersHorizontalIcon aria-hidden />
                {inspectorTitle}
                {activeCount > 0 && (
                  <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[11px] leading-5 tabular-nums">
                    {activeCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[320px] overflow-y-auto sm:max-w-sm" side="right">
              <SheetHeader>
                <SheetTitle>{inspectorTitle}</SheetTitle>
                {inspectorDescription && (
                  <SheetDescription>{inspectorDescription}</SheetDescription>
                )}
              </SheetHeader>
              <div className="px-4 pb-6">{open && inspector}</div>
            </SheetContent>
          </Sheet>
        </div>
        {children}
      </div>
      <aside aria-label={inspectorTitle} className="hidden xl:block">
        <Card className="sticky top-[calc(var(--header-height,56px)+16px)] gap-4 px-4 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{inspectorTitle}</h2>
            {inspectorDescription && (
              <p className="text-muted-foreground mt-0.5 text-xs">{inspectorDescription}</p>
            )}
          </div>
          {inspector}
        </Card>
      </aside>
    </div>
  );
}
