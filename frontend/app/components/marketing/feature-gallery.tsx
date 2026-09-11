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
    const update = () =>
      setEdges({
        start: element.scrollLeft <= 2,
        end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
      });
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
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
