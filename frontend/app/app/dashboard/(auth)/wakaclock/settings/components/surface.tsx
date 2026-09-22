'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

import styles from '../settings.module.css';

/** Card surface with a soft highlight that follows the pointer. */
export function Surface({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        styles.surface,
        'bg-card text-card-foreground rounded-2xl border shadow-xs',
        className
      )}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function SurfaceHeader({
  actions,
  description,
  icon,
  title,
}: {
  actions?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  const IconComponent = icon;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        {IconComponent && (
          <span className="bg-muted text-foreground grid size-9 shrink-0 place-items-center rounded-xl border">
            <IconComponent className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {description && (
            <p className="text-muted-foreground mt-1 max-w-prose text-sm leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
