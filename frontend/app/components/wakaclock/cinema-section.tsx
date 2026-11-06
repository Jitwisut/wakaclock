import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * An editorial section opener for Cinema pages: a scene number, a display headline, an
 * optional serif aside and actions on the right, ruled off from the content below.
 * Presentation only — pages keep their own data and panels.
 */
export function CinemaSection({
  actions,
  aside,
  children,
  className,
  id,
  number,
  title,
}: {
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id: string;
  number: string;
  title: string;
}) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-6', className)}>
      <header className="grid grid-cols-1 items-end gap-4 border-b pb-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-baseline gap-4">
          <span aria-hidden className="cinema-label text-primary! shrink-0">
            {number}
          </span>
          <div className="min-w-0">
            <h2
              className="font-display text-[length:var(--type-title)] leading-[1.02] font-medium"
              id={id}
            >
              {title}
            </h2>
            {aside && <p className="cinema-serif text-muted-foreground mt-1 text-lg">{aside}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
