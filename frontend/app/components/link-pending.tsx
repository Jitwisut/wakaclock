'use client';

import { useLinkStatus } from 'next/link';

/**
 * Navigation feedback for the gap between "I clicked" and "the next page painted".
 *
 * Must be rendered *inside* a `<Link>` — that is what lets `useLinkStatus()` report that
 * particular link's pending state. Without it, a route transition that has to fetch or
 * stream is indistinguishable from a dead click, and the reflex is to click again.
 *
 * The visible marker is a small square rather than a spinner so it can inherit whichever
 * blink/pulse animation the surrounding theme uses (`indicatorClassName`), and the same
 * fact is exposed to assistive technology through a live region.
 */
export function LinkPending({
  indicatorClassName = 'animate-pulse',
  label,
}: {
  indicatorClassName?: string;
  label: string;
}) {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <>
      <span
        aria-hidden
        className={`ml-1.5 inline-block size-2 shrink-0 align-middle ${indicatorClassName}`}
        data-testid="link-pending"
        style={{ background: 'currentColor' }}
      />
      <span className="sr-only" role="status">
        {label}
      </span>
    </>
  );
}
