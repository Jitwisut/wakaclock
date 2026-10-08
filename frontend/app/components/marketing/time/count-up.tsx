'use client';

import { type ComponentRef, useEffect, useRef, useState } from 'react';

const DURATION_MS = 1300;

/**
 * Counts up to `value` the first time it scrolls into view. The server render and reduced
 * motion show the final value; digits render through React state so WebKit repaints them.
 */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<ComponentRef<'span'>>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const node = ref.current as ComponentRef<'span'>;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    setShown(0);
    let frame = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / DURATION_MS);
        setShown(Math.round((1 - (1 - progress) ** 3) * value));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref}>
      <span aria-hidden="true">{shown}</span>
      <span className="tx-sr-only">{value}</span>
    </span>
  );
}
