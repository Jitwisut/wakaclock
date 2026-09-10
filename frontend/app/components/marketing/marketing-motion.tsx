'use client';

import { useEffect, useRef } from 'react';

import { usePathname } from 'next/navigation';

/** Progressive enhancement: content stays readable before JS and without animation APIs. */
export function MarketingMotion() {
  const marker = useRef<globalThis.HTMLSpanElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = marker.current?.closest<globalThis.HTMLElement>('.wakaclock-marketing');
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root || typeof IntersectionObserver === 'undefined') return;

    let observer: IntersectionObserver | undefined;
    const animations = new Set<globalThis.Animation>();
    const stop = () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      animations.clear();
      delete root.dataset.motionReady;
    };
    const start = () => {
      stop();
      if (preference.matches) return;
      root.dataset.motionReady = 'true';
      const compact = window.matchMedia('(max-width: 767px)').matches;
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer?.unobserve(entry.target);
            if (typeof entry.target.animate !== 'function') return;
            const animation = entry.target.animate(
              [
                {
                  opacity: 0.15,
                  transform: compact
                    ? 'translateY(24px)'
                    : 'perspective(1200px) translateY(56px) rotateX(8deg) scale(0.97)',
                },
                { opacity: 1, transform: 'perspective(1200px) translateY(0) rotateX(0) scale(1)' },
              ],
              { duration: compact ? 550 : 850, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
            );
            animations.add(animation);
            animation.onfinish = () => animations.delete(animation);
          });
        },
        { rootMargin: '0px 0px -32px 0px', threshold: 0 }
      );
      root
        .querySelectorAll('.mkt-reveal, .mkt-story-grid > section, .mkt-feature-card')
        .forEach((element) => {
          // Avoid animating both a card and its container, or the initial viewport.
          if (element.querySelector('.mkt-feature-card')) return;
          if (element.getBoundingClientRect().top < window.innerHeight) return;
          observer?.observe(element);
        });
    };
    start();
    preference.addEventListener('change', start);
    return () => {
      stop();
      preference.removeEventListener('change', start);
    };
  }, [pathname]);

  return <span aria-hidden="true" hidden ref={marker} />;
}
