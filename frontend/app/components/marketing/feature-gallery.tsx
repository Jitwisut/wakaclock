'use client';

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named overflow regions must be keyboard-scrollable. */

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
      const distance = element.scrollWidth - element.clientWidth;
      element.parentElement?.style.setProperty(
        '--gallery-progress',
        String(distance > 0 ? Math.min(1, Math.max(0, element.scrollLeft / distance)) : 1)
      );
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
  useEffect(() => {
    const element = rail.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    // The rail is the observer root: cards reveal on horizontal swipes as well
    // as page scroll, without running a transform loop on every pointer move.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          (entry.target as globalThis.HTMLElement).dataset.inView = String(entry.isIntersecting);
        }
      },
      { root: element, threshold: 0.2 }
    );
    [...element.children].forEach((card) => observer.observe(card));
    return () => observer.disconnect();
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
      <div
        aria-label={locale === 'th' ? 'เลื่อนดูฟีเจอร์ AtoAxis' : 'Explore AtoAxis features'}
        className="axis-feature-list"
        id={id}
        ref={rail}
        role="region"
        tabIndex={0}
      >
        {children}
      </div>
      <div aria-hidden="true" className="axis-gallery-progress">
        <span />
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
