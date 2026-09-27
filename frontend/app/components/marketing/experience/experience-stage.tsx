'use client';

import { useEffect, useRef, useState } from 'react';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import { localizedPath, type SiteLocale } from '@/lib/seo/site';

import { ChapterRail } from './chapter-rail';
import { EXPERIENCE_COPY } from './experience-copy';
import { ExperienceCursor } from './experience-cursor';
import { setUi, useExperienceUi } from './experience-store';
import { StillScene } from './still-scene';
import { useStoryScroll } from './use-story-scroll';

import type { SceneQuality } from './scene/activity-canvas';

/** three.js and the scene only download after the page has painted and gone idle. */
const ActivityCanvas = dynamic(
  () =>
    import('./scene/activity-canvas').then((module) => {
      setUi({ loadStep: 1 });
      return module;
    }),
  { ssr: false }
);

function supportsWebGl() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Picks a quality tier from what the device says about itself. Phones and low-power
 * devices still get the story, with fewer marks, a capped pixel ratio and no hover probe;
 * reduced motion and missing WebGL get the still composition instead of a canvas.
 */
function chooseQuality(): null | SceneQuality {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (!supportsWebGl()) return null;
  const nav = navigator as {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  } & typeof navigator;
  if (nav.connection?.saveData) return null;
  const compact = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
  const lowPower = (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  if (compact) return { days: 7, maxDpr: 1.25, interactive: false };
  if (lowPower) return { days: 10, maxDpr: 1.25, interactive: true };
  return { days: 14, maxDpr: 1.75, interactive: true };
}

function whenIdle(callback: () => void) {
  const run = () => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(callback, { timeout: 1800 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(callback, 600);
    return () => globalThis.clearTimeout(id);
  };
  if (document.readyState === 'complete') return run();
  let cancel: (() => void) | undefined;
  const onLoad = () => {
    cancel = run();
  };
  window.addEventListener('load', onLoad, { once: true });
  return () => {
    window.removeEventListener('load', onLoad);
    cancel?.();
  };
}

/**
 * The client island behind the chapters: scroll choreography, the sticky 3D stage, the
 * loader, the chapter rail and the cursor. Everything it renders is decorative or
 * duplicated in HTML — the chapters themselves are server-rendered by `CinematicHome`.
 */
export function ExperienceStage({ locale, rootId }: { locale: SiteLocale; rootId: string }) {
  const copy = EXPERIENCE_COPY[locale];
  const root = useRef<HTMLElement | null>(null);
  const [quality, setQuality] = useState<null | SceneQuality | undefined>(undefined);
  const [visible, setVisible] = useState(true);
  const status = useExperienceUi((state) => state.sceneStatus);
  const step = useExperienceUi((state) => state.loadStep);

  useEffect(() => {
    root.current = document.querySelector<HTMLElement>(`#${rootId}`);
  }, [rootId]);
  useStoryScroll(root);

  useEffect(() => {
    const chosen = chooseQuality();
    if (!chosen) {
      setQuality(null);
      setUi({ sceneStatus: 'fallback' });
      return;
    }
    return whenIdle(() => {
      setUi({ sceneStatus: 'loading', loadStep: 0 });
      setQuality(chosen);
    });
  }, []);

  useEffect(() => {
    const element = root.current;
    if (element) element.dataset.scene = status;
  }, [status]);

  // Stop rendering entirely once the visitor has scrolled past the experience.
  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden="true" className="axx-stage">
        <StillScene />
        {quality ? (
          <div className="axx-canvas">
            <ActivityCanvas active={visible} copy={copy} locale={locale} quality={quality} />
          </div>
        ) : null}
        {/* Reading veil: the backdrop softens behind whichever text column is active. */}
        <div className="axx-veil" data-veil="side" />
        <div className="axx-veil" data-veil="center" />
        <div className="axx-grain" />
      </div>
      {/* Sticky like the stage, so the rail and loader leave with the experience. */}
      <div className="axx-overlay">
        <div aria-live="polite" className="axx-loader" data-status={status} role="status">
          {/* Kept through 'ready' so the finished steps can fade out rather than vanish. */}
          {status === 'loading' || status === 'ready' ? (
            <>
              <span className="axx-loader-label">{copy.loader.label}</span>
              <ol className="axx-loader-steps">
                {copy.loader.steps.map((label, index) => (
                  <li data-done={step > index} key={label}>
                    <i aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {status === 'ready' ? <span className="sr-only">{copy.loader.ready}</span> : null}
          {status === 'fallback' ? <span className="sr-only">{copy.loader.skipped}</span> : null}
        </div>
        <ChapterRail copy={copy} />
        {/* Persistent conversion path while the story plays; leaves with the experience. */}
        <Link
          className="axx-persistent-cta"
          data-magnetic
          href={localizedPath(locale, '/early-access')}
        >
          {copy.hero.join}
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <ExperienceCursor />
    </>
  );
}
