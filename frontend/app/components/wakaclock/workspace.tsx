'use client';

import * as React from 'react';

import { SlidersHorizontalIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
export const SEGMENTED_GROUP = 'inline-flex gap-1 shadow-[inset_0_-1px_0_var(--border)]';
export const SEGMENTED_ITEM =
  'text-muted-foreground hover:text-foreground aria-pressed:text-foreground min-h-9 px-2.5 font-mono text-[0.6875rem] font-medium tracking-[0.1em] uppercase tabular-nums transition-[color,box-shadow] aria-pressed:shadow-[inset_0_-2px_0_var(--primary)] motion-reduce:transition-none';

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
    <div className={cn('overflow-hidden border-y', className)} data-slot="metric-strip">
      {/* Each cell draws its own right and bottom hairline; the list sits one pixel past
          the card on those sides so the outer lines are clipped. An unfilled last row
          then shows the card surface rather than a block of divider colour. */}
      <dl
        aria-label={ariaLabel}
        className={cn('-mr-px -mb-px grid grid-cols-2 sm:grid-cols-3', columns)}
      >
        {metrics.map((metric) => (
          <div
            className="flex min-w-0 flex-col gap-2 border-r border-b px-4 py-4"
            key={metric.label}
          >
            <dt className="cinema-label truncate">{metric.label}</dt>
            <dd className="font-display text-[1.625rem] leading-none font-medium tracking-[-0.03em] tabular-nums">
              {metric.value}
            </dd>
            {metric.hint && (
              <dd className="text-muted-foreground truncate text-xs">{metric.hint}</dd>
            )}
          </div>
        ))}
      </dl>
    </div>
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
    <div className="overflow-hidden border-y" data-slot="metric-group">
      {/* Same hairline scheme as MetricStrip. The tiles are cards, so the inset line has to
          outrank the theme's card elevation. */}
      <div
        className={cn(
          '-mr-px -mb-px grid grid-cols-1 [&>*]:rounded-none [&>*]:border-0 [&>*]:!bg-transparent [&>*]:!shadow-[inset_-1px_-1px_0_0_var(--border)]',
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
    <section
      className={cn('flex min-w-0 flex-col gap-4 border-t pt-4', className)}
      data-slot="widget"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[1.0625rem] leading-tight font-medium tracking-[-0.02em]">
            {title}
          </h2>
          {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
        </div>
        {action}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
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
      <legend className="cinema-label mb-2.5">{legend}</legend>
      <div className="flex flex-col gap-4 rounded-(--radius) border p-4 [&_[data-slot=native-select-wrapper]]:w-full">
        {children}
      </div>
      {footnote && <p className="text-muted-foreground mt-2 text-xs">{footnote}</p>}
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
      className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 border-y px-6 py-14 text-center"
      data-slot="unavailable-notice"
    >
      <h2
        className="font-display text-2xl font-medium tracking-[-0.03em]"
        id="unavailable-notice-title"
      >
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
      className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_288px]"
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
        <div className="sticky top-[calc(var(--bar-height,56px)+24px)] flex flex-col gap-4 border-l pl-6">
          <div>
            <h2 className="cinema-label">{inspectorTitle}</h2>
            {inspectorDescription && (
              <p className="text-muted-foreground mt-1.5 text-xs">{inspectorDescription}</p>
            )}
          </div>
          {inspector}
        </div>
      </aside>
    </div>
  );
}
