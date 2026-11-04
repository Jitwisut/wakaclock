import type * as React from 'react';

/**
 * The page toolbar every dashboard page opens with: a compact title and one-line
 * description on the left, the page's own controls (range, actions) on the right, and an
 * optional second row for section navigation. It replaces the old oversized heading so
 * content starts near the top of the window, the way a desktop app's toolbar does.
 */
export function WakaclockPageHeader({
  actions,
  children,
  description,
  title,
}: {
  actions?: React.ReactNode;
  /** A second row, typically a segmented control for sibling views. */
  children?: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-3" data-slot="page-toolbar">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl leading-tight font-semibold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-0.5 max-w-3xl text-sm text-pretty">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
