import type * as React from 'react';

import Link from 'next/link';

/**
 * The Cinema frame for pages outside the dashboard shell (password reset, error pages):
 * a dark editorial stage with the headline on one side, the page's own content on the
 * other. Presentation only — each page keeps its behaviour and renders this through
 * `LayoutSwitch`, so other presets keep their original markup.
 */
export function CinemaGuestFrame({
  aside,
  children,
  headline,
  kicker,
  title,
}: {
  aside?: string;
  children: React.ReactNode;
  /** The oversized display line (an error code, a short phrase). */
  headline: string;
  kicker: string;
  /** The page's heading, set under the headline. */
  title: string;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="cinema-guest-title"
        className="flex flex-col justify-between gap-16 bg-(--stage) px-[var(--gutter)] py-10 text-(--stage-foreground) lg:py-14"
      >
        <Link
          className="font-display w-fit text-xl font-medium tracking-[-0.03em]"
          href="/dashboard/wakaclock"
        >
          AtoAxis
        </Link>
        <div>
          <p className="cinema-label text-(--stage-muted)!">{kicker}</p>
          <p
            aria-hidden
            className="font-display mt-4 text-[length:clamp(5rem,14vw,12rem)] leading-[0.82] font-medium tracking-[-0.06em]"
          >
            {headline}
          </p>
          <h1
            className="font-display mt-6 text-3xl font-medium tracking-[-0.03em]"
            id="cinema-guest-title"
          >
            {title}
          </h1>
          {aside && <p className="cinema-serif mt-2 text-xl text-(--stage-muted)">{aside}</p>}
        </div>
        <p className="cinema-label text-(--stage-muted)!">Developer time tracking</p>
      </section>
      <div className="flex items-center justify-center px-[var(--gutter)] py-12">{children}</div>
    </div>
  );
}
