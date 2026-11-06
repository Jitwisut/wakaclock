'use client';

import type * as React from 'react';

import { useCinemaScene } from '@/components/layout/cinema/cinema-scene-context';

/**
 * The Cinema page opener: the scene number and section from the navigation rail in mono,
 * an oversized display headline, a measured description and the page's own controls on
 * the right, ruled off from the content. An optional second row carries sibling views.
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
  const scene = useCinemaScene();
  const section = scene && scene.item.title !== title ? scene.item.title : null;

  return (
    <header className="flex flex-col gap-5 border-b pb-6" data-slot="page-toolbar">
      <div className="grid grid-cols-1 items-end gap-x-8 gap-y-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          {scene && (
            <p className="cinema-label flex items-center gap-2">
              <span className="text-primary">{scene.number}</span>
              {section && <span>· {section}</span>}
            </p>
          )}
          <h1 className="font-display mt-3 text-[length:clamp(2.25rem,4.2vw,4rem)] leading-[0.95] font-medium tracking-[-0.04em] text-balance">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-pretty">
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
