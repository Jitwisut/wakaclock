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

/** A segmented control: a recessed track whose pressed button (`aria-pressed`) is raised. */
export const SEGMENTED_GROUP =
  'bg-muted inline-flex gap-0.5 rounded-lg p-0.5 shadow-[inset_0_0_0_1px_var(--border)]';
export const SEGMENTED_ITEM =
  'text-muted-foreground hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground min-h-8 rounded-md px-3 text-sm font-medium tabular-nums transition-colors aria-pressed:shadow-sm motion-reduce:transition-none';

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
      {/* Each cell draws its own right and bottom hairline; the list sits one pixel past
          the card on those sides so the outer lines are clipped. An unfilled last row
          then shows the card surface rather than a block of divider colour. */}
      <dl
        aria-label={ariaLabel}
        className={cn('-mr-px -mb-px grid grid-cols-2 sm:grid-cols-3', columns)}
      >
        {metrics.map((metric) => (
          <div
            className="flex min-w-0 flex-col gap-1 border-r border-b px-4 py-3.5"
            key={metric.label}
          >
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
    <div className="bg-card overflow-hidden rounded-xl border" data-slot="metric-group">
      {/* Same hairline scheme as MetricStrip. The tiles are cards, so the inset line has to
          outrank the theme's card elevation. */}
      <div
        className={cn(
          '-mr-px -mb-px grid grid-cols-1 [&>*]:rounded-none [&>*]:border-0 [&>*]:!shadow-[inset_-1px_-1px_0_0_var(--border)]',
          className
        )}
      >
        {children}
      </div>
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
 * One labelled group of form fields on a single surface, the grouped-form pattern used by
 * the small tool pages. Several groups stack into a form; the footnote explains the group.
 */
export function FieldGroup({
  children,
  className,
  footnote,
  legend,
}: {
  children: React.ReactNode;
  className?: string;
  footnote?: React.ReactNode;
  legend: string;
}) {
  return (
    <fieldset className={cn('min-w-0', className)} data-slot="field-group">
      <legend className="text-muted-foreground mb-2 px-1 text-xs font-medium">{legend}</legend>
      <div className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-xs [&_[data-slot=native-select-wrapper]]:w-full">
        {children}
      </div>
      {footnote && <p className="text-muted-foreground mt-2 px-1 text-xs">{footnote}</p>}
    </fieldset>
  );
}

/**
 * A centred notice for a page whose feature this deployment does not run. It replaces the
 * whole canvas, so it reads as a state of the deployment rather than a failed widget.
 */
export function UnavailableNotice({
  children,
  title,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="unavailable-notice-title"
      className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center"
      data-slot="unavailable-notice"
    >
      <h2 className="text-base font-semibold tracking-tight" id="unavailable-notice-title">
        {title}
      </h2>
      <div className="text-muted-foreground flex flex-col gap-2 text-sm text-balance">
        {children}
      </div>
    </section>
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
      className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_288px]"
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
