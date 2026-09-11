'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import type { SiteLocale } from '@/lib/seo/site';

export function FeatureGallery({ children, locale }: { children: ReactNode; locale: SiteLocale }) {
  const rail = useRef<globalThis.HTMLDivElement>(null);
  const id = useId();
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = {
        start: element.scrollLeft <= 2,
        end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
      };
      setEdges((previous) =>
        previous.start === next.start && previous.end === next.end ? previous : next
      );
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    element.addEventListener('scroll', schedule, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    observer?.observe(element);
    return () => {
      window.cancelAnimationFrame(frame);
      element.removeEventListener('scroll', schedule);
      observer?.disconnect();
    };
  }, []);
  const move = (direction: number) => {
    const element = rail.current;
    if (!element) return;
    const width = element.firstElementChild?.getBoundingClientRect().width ?? element.clientWidth;
    element.scrollBy({
      left: direction * (width + 24),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };
  return (
    <div className="axis-gallery">
      <div className="axis-feature-list" id={id} ref={rail}>
        {children}
      </div>
      <div className="axis-gallery-controls">
        <button
          aria-controls={id}
          aria-label={locale === 'th' ? 'ฟีเจอร์ก่อนหน้า' : 'Previous features'}
          disabled={edges.start}
          onClick={() => move(-1)}
          type="button"
        >
          ←
        </button>
        <button
          aria-controls={id}
          aria-label={locale === 'th' ? 'ฟีเจอร์ถัดไป' : 'Next features'}
          disabled={edges.end}
          onClick={() => move(1)}
          type="button"
        >
          →
        </button>
      </div>
    </div>
  );
}
