'use client';

import { useEffect, useRef } from 'react';

import { usePathname } from 'next/navigation';

const HERO_HEIGHT_PROPERTY = '--hero-stage-height';
const HERO_TOP_PROPERTY = '--hero-top';
type RevealFrame = { clipPath?: string; transform: string };

/** Progressive enhancement: content stays readable before JS and without animation APIs. */
export function MarketingMotion() {
  const marker = useRef<globalThis.HTMLSpanElement>(null);
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    const root = marker.current?.closest('.wakaclock-marketing');
    const hero = root?.querySelector<globalThis.HTMLElement>('.axis-hero');
    const stage = hero?.querySelector<globalThis.HTMLElement>('.axis-hero-stage');
    if (!hero || !stage) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const canPin = window.matchMedia('(min-width: 1024px) and (min-height: 680px)');
    const nav = root?.querySelector('.axis-nav');
    const measure = () => {
      if (preference.matches || !canPin.matches) {
        hero.dataset.pinned = 'false';
        hero.style.removeProperty(HERO_HEIGHT_PROPERTY);
        hero.style.removeProperty(HERO_TOP_PROPERTY);
        return;
      }
      const top = nav?.getBoundingClientRect().height ?? 82;
      const { height } = stage.getBoundingClientRect();
      const fits = height > 0 && height <= window.innerHeight - top - 8;
      const supported = window.CSS?.supports?.('animation-timeline: view()') ?? false;
      const pinned = String(fits && supported);
      const stageHeight = `${Math.round(height)}px`;
      const heroTop = `${Math.round(top)}px`;
      if (hero.dataset.pinned !== pinned) hero.dataset.pinned = pinned;
      if (hero.style.getPropertyValue(HERO_HEIGHT_PROPERTY) !== stageHeight) {
        hero.style.setProperty(HERO_HEIGHT_PROPERTY, stageHeight);
      }
      if (hero.style.getPropertyValue(HERO_TOP_PROPERTY) !== heroTop) {
        hero.style.setProperty(HERO_TOP_PROPERTY, heroTop);
      }
    };
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(stage);
    if (nav) observer?.observe(nav);
    measure();
    window.addEventListener('resize', measure);
    preference.addEventListener('change', measure);
    canPin.addEventListener('change', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      preference.removeEventListener('change', measure);
      canPin.removeEventListener('change', measure);
      delete hero.dataset.pinned;
      hero.style.removeProperty(HERO_HEIGHT_PROPERTY);
      hero.style.removeProperty(HERO_TOP_PROPERTY);
    };
  }, [pathname]);

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
      const main = root.querySelector('main');
      if (lastPath.current !== pathname && typeof main?.animate === 'function') {
        const transition = main.animate([{ opacity: 0.65 }, { opacity: 1 }], {
          duration: 240,
          easing: 'ease-out',
        });
        animations.add(transition);
        transition.onfinish = () => animations.delete(transition);
      }
      const compact = window.matchMedia('(max-width: 1023px)').matches;
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer?.unobserve(entry.target);
            if (typeof entry.target.animate !== 'function') return;
            const staggerStep = compact ? 45 : 80;
            const heading = entry.target.matches('h1,h2,h3');
            const picture = entry.target.matches('figure, .mkt-page-art, .mkt-workspace-art');
            let from: RevealFrame = compact
              ? { transform: 'translateY(10px)' }
              : { clipPath: 'inset(0 0 0 0)', transform: 'translateY(18px)' };
            if (heading && !compact) {
              from = { clipPath: 'inset(0 0 95% 0)', transform: 'translateY(24px)' };
            } else if (picture && !compact) {
              from = {
                clipPath: 'inset(6% 4% 6% 4%)',
                transform: 'perspective(1200px) rotateX(4deg) scale(.97)',
              };
            }
            const animation = entry.target.animate(
              [
                from,
                compact ? { transform: 'none' } : { clipPath: 'inset(0 0 0 0)', transform: 'none' },
              ],
              {
                duration: compact ? 420 : 1100,
                delay: entry.target.matches(
                  '.axis-chapter-copy > *, .axis-pricing-detail li, .axis-section-heading > *, .axis-setup-step > *'
                )
                  ? Math.min(
                      3,
                      [...(entry.target.parentElement?.children ?? [])].indexOf(entry.target)
                    ) * staggerStep
                  : 0,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'backwards',
              }
            );
            animations.add(animation);
            animation.onfinish = () => animations.delete(animation);
          });
        },
        { rootMargin: '0px 0px -32px 0px', threshold: 0 }
      );
      const revealSelector = compact
        ? '.mkt-reveal, main h2, .axis-section-heading > *, .mkt-page-intro > *'
        : '.mkt-reveal, main h2, main h3, .axis-chapter-copy > *, .axis-pricing-detail li, .axis-section-heading > *, .mkt-page-intro > *, .axis-setup-step > *';
      root.querySelectorAll(revealSelector).forEach((element) => {
        // Animate the innermost reveal only; leave the initial viewport undisturbed.
        if (
          element.querySelector(
            '.mkt-reveal, h2, h3, .axis-chapter-copy, .axis-pricing-detail, .axis-section-heading'
          )
        ) {
          return;
        }
        if (element.matches('.axis-setup-step')) return;
        // Scroll-scrubbed surfaces have their own timeline; avoid two transforms.
        if (
          window.CSS?.supports?.('animation-timeline: view()') &&
          element.matches(
            '.axis-feature-row, .axis-pricing-detail li, .mkt-workspace-art, .mkt-page-art'
          )
        ) {
          return;
        }
        if (element.getBoundingClientRect().top < window.innerHeight) return;
        observer?.observe(element);
      });
    };
    start();
    lastPath.current = pathname;
    preference.addEventListener('change', start);
    return () => {
      stop();
      preference.removeEventListener('change', start);
    };
  }, [pathname]);

  return <span aria-hidden="true" hidden ref={marker} />;
}
