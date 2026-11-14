'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NAV_LINKS } from '../../nav-links.data';
import { timeMotion } from '../time-store';

import { PLACE_ATTRIBUTE, PLACES, TOUR, tourIndex, tourStop } from './world-places';

/**
 * World mode: the homepage as an archipelago (owner decision 2026-11-14). It only ever
 * enhances the server-rendered page — every section stays in the HTML, in order. With
 * WebGL available, this component tags each section with the place it belongs to, hides
 * the long scroll and turns it into a tour: scrolling flies the camera from place to place
 * along a route, locks onto the nearest one when the scroll rests and opens that place's
 * sections in a reading panel (clicking a place flies straight there). Without WebGL (or with reduced motion) it never
 * mounts and the page reads top to bottom as before.
 *
 * Hotspot labels are the page's own headings and nav links, read at runtime.
 */

/** UI chrome for the panel; rendered on the client only, never part of the page copy. */
const CHROME = {
  en: { close: 'Back to the map', places: 'Places' },
  th: { close: 'กลับสู่แผนที่', places: 'สถานที่' },
} as const;

const HOME = '#tx-c0';
/** Shown while the camera is between places: no section belongs to it. */
const TRAVEL = 'travel';
/** Wheel distance (px) from one stop to the next. */
const STOP_PIXELS = 620;
/** How far the scroll must leave a stop before it commits to the next one. */
const COMMIT = 0.14;
/** Quiet time after the last scroll input before the tour locks onto a stop. */
const SETTLE_MS = 170;
/** Time the camera gets to arrive before the place opens, per stop crossed. */
const ARRIVE_MS = 620;

/** Whether `element` (or a scrollable ancestor inside the panel) can still scroll that way. */
function canScroll(element: Element | null, direction: number) {
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (!/auto|scroll/.test(style.overflowY) || node.scrollHeight <= node.clientHeight + 1) {
      continue;
    }
    if (direction > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
    if (direction < 0 && node.scrollTop > 0) return true;
  }
  return false;
}

interface Hotspot {
  href?: string;
  id: string;
  label: string;
}

function localeOf(root: HTMLElement) {
  return root.getAttribute('lang') === 'th' ? 'th' : 'en';
}

/** Reads a hotspot's label from the page: a heading inside its section, or a nav link. */
function readLabel(root: HTMLElement, place: (typeof PLACES)[number], locale: 'en' | 'th') {
  if (place.href) {
    const link = NAV_LINKS.find((entry) => entry.href === place.href);
    return link ? link.label[locale] : '';
  }
  const heading = place.labelFrom ? root.querySelector(place.labelFrom) : null;
  return heading?.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '';
}

function localHref(locale: 'en' | 'th', href: string) {
  return locale === 'th' ? `/th${href}` : href;
}

export function WorldMode({ rootId }: { rootId: string }) {
  const [open, setOpen] = useState('');
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [locale, setLocale] = useState<'en' | 'th'>('en');
  const frame = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const lastOpen = useRef('');
  /** The stop the tour last locked onto, and the timers that lock and open. */
  const base = useRef(0);
  /** An in-page link's destination, scrolled to when its place opens. */
  const pendingTarget = useRef<HTMLElement | null>(null);
  const settleTimer = useRef(0);
  const openTimer = useRef(0);

  // Enter world mode: tag sections, read labels, lock the page scroll.
  useEffect(() => {
    const story = document.querySelector<HTMLElement>(`#${rootId}`);
    const site = story?.closest<HTMLElement>('.wakaclock-marketing');
    if (!story || !site) return;
    frame.current = site;
    const pageLocale = localeOf(site);
    setLocale(pageLocale);
    site.querySelector(HOME)?.setAttribute(PLACE_ATTRIBUTE, 'home');
    for (const place of PLACES) {
      for (const selector of place.sections) {
        for (const element of site.querySelectorAll(selector)) {
          element.setAttribute(PLACE_ATTRIBUTE, place.id);
        }
      }
    }
    setHotspots(
      PLACES.map((place) => ({
        id: place.id,
        href: place.href ? localHref(pageLocale, place.href) : undefined,
        label: readLabel(site, place, pageLocale),
      })).filter((entry) => entry.label)
    );
    site.dataset.world = 'on';
    timeMotion.world = true;
    return () => {
      delete site.dataset.world;
      delete site.dataset.worldOpen;
      timeMotion.world = false;
      timeMotion.place = '';
      timeMotion.tour = 0;
      window.clearTimeout(settleTimer.current);
      window.clearTimeout(openTimer.current);
      for (const element of site.querySelectorAll<HTMLElement>(`[${PLACE_ATTRIBUTE}]`)) {
        element.removeAttribute(PLACE_ATTRIBUTE);
        delete element.dataset.worldOpen;
      }
    };
  }, [rootId]);

  // Open a place: show its sections in the panel and send the camera there.
  useEffect(() => {
    const site = frame.current;
    if (!site) return;
    const target = open || 'home';
    const reading = open && open !== TRAVEL ? open : '';
    for (const element of site.querySelectorAll<HTMLElement>(`[${PLACE_ATTRIBUTE}]`)) {
      if (element.getAttribute(PLACE_ATTRIBUTE) === target) {
        element.dataset.worldOpen = '';
      } else delete element.dataset.worldOpen;
    }
    site.dataset.worldOpen = open;
    timeMotion.place = reading;
    if (open === TRAVEL) return;
    if (!open) {
      // Back on the map: return keyboard focus to the place that was just read.
      const previous = lastOpen.current;
      lastOpen.current = '';
      site
        .querySelector<HTMLElement>(`[data-hotspot="${previous}"] button`)
        ?.focus({ preventScroll: true });
      return;
    }
    lastOpen.current = open;
    // The panel scrolls itself; start each visit at its top and move focus into it.
    const first = site.querySelector<HTMLElement>(`[${PLACE_ATTRIBUTE}="${open}"]`);
    const panel = first?.parentElement;
    if (panel) panel.scrollTop = 0;
    const wanted = pendingTarget.current;
    pendingTarget.current = null;
    if (wanted && wanted !== first && wanted.closest(`[${PLACE_ATTRIBUTE}="${open}"]`)) {
      wanted.scrollIntoView({ block: 'start' });
    }
    const heading = first?.querySelector<HTMLElement>('h2, h3');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, [open]);

  /**
   * Locks the tour onto a stop: the camera flies there and, once it has had time to arrive,
   * the place opens (the map opens at once — the hero is already in view).
   */
  const lockTo = useCallback((index: number) => {
    const stop = Math.min(TOUR.length, Math.max(0, index));
    const crossed = Math.abs(stop - base.current);
    const moved = Math.abs(timeMotion.tour - stop) > 0.001;
    base.current = stop;
    timeMotion.tour = stop;
    window.clearTimeout(settleTimer.current);
    window.clearTimeout(openTimer.current);
    const id = tourStop(stop);
    if (!id) {
      setOpen('');
      return;
    }
    if (!moved && crossed === 0) {
      setOpen(id);
      return;
    }
    setOpen((current) => (current === id ? current : TRAVEL));
    openTimer.current = window.setTimeout(
      () => setOpen(id),
      Math.min(1500, ARRIVE_MS + crossed * 180)
    );
  }, []);

  const goTo = useCallback(
    (id: string) => lockTo(id === 'home' ? 0 : Math.max(0, tourIndex(id))),
    [lockTo]
  );

  // The scroll tour: wheel, touch and keys move along the route; when the input rests the
  // tour locks onto the nearest stop the gesture committed to.
  useEffect(() => {
    const site = frame.current;
    if (!site) return;
    let edgeQuietSince = 0;
    let touchY: null | number = null;
    let touching = false;

    const settle = () => {
      const from = base.current;
      const moved = timeMotion.tour - from;
      let stop = from;
      if (moved > COMMIT) stop = Math.ceil(timeMotion.tour);
      else if (moved < -COMMIT) stop = Math.floor(timeMotion.tour);
      lockTo(stop);
    };
    const advance = (amount: number) => {
      const next = Math.min(TOUR.length, Math.max(0, timeMotion.tour + amount));
      if (next === timeMotion.tour) return;
      timeMotion.tour = next;
      window.clearTimeout(openTimer.current);
      // Leaving a place closes it; the map's hero goes the same way.
      if (Math.abs(next - base.current) > COMMIT) setOpen(TRAVEL);
      window.clearTimeout(settleTimer.current);
      if (!touching) settleTimer.current = window.setTimeout(settle, SETTLE_MS);
    };
    /** Input inside a panel that can still scroll belongs to the panel, not the tour. */
    const heldByPanel = (target: EventTarget | null, direction: number) => {
      const element = target instanceof Element ? target : null;
      if (!element?.closest(`[${PLACE_ATTRIBUTE}], .tx-chapters, .tx-day`)) return false;
      const now = performance.now();
      if (canScroll(element, direction)) {
        edgeQuietSince = now;
        return true;
      }
      // At the panel's end: the same gesture (and its inertia) must not carry the reader
      // off the island. Only a fresh gesture, after a short rest, moves on.
      if (now - edgeQuietSince < 320) {
        edgeQuietSince = now;
        return true;
      }
      return false;
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const pixels = event.deltaMode === 1 ? event.deltaY * 32 : event.deltaY;
      if (heldByPanel(event.target, Math.sign(pixels))) return;
      advance(pixels / STOP_PIXELS);
    };
    const onTouchStart = (event: TouchEvent) => {
      touching = true;
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (y === undefined || touchY === null) return;
      const moved = touchY - y;
      touchY = y;
      if (heldByPanel(event.target, Math.sign(moved))) return;
      advance(moved / (window.innerHeight * 0.55));
    };
    const onTouchEnd = () => {
      touching = false;
      touchY = null;
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(settle, 60);
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const forward = ['ArrowDown', 'PageDown'].includes(event.key);
      const back = ['ArrowUp', 'PageUp'].includes(event.key);
      if (event.key === 'Home') lockTo(0);
      else if (event.key === 'End') lockTo(TOUR.length);
      else if (forward || back) {
        if (heldByPanel(document.activeElement, forward ? 1 : -1)) return;
        lockTo(base.current + (forward ? 1 : -1));
      } else return;
      event.preventDefault();
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [lockTo]);

  // In-page links (#features, #faq, the rail…) open the place that holds their target.
  useEffect(() => {
    const site = frame.current;
    if (!site) return;
    const reveal = (hash: string) => {
      const target =
        hash.length > 1
          ? document.querySelector<HTMLElement>(
              `#${window.CSS.escape(decodeURIComponent(hash.slice(1)))}`
            )
          : null;
      const holder = target?.closest(`[${PLACE_ATTRIBUTE}]`);
      if (!target || !holder) return false;
      goTo(holder.getAttribute(PLACE_ATTRIBUTE) ?? 'home');
      // The panel opens once the camera arrives; the open effect scrolls to the target then.
      pendingTarget.current = target;
      return true;
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (link && reveal(link.getAttribute('href') ?? '')) {
        event.preventDefault();
        window.history.pushState(null, '', link.getAttribute('href'));
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && site.dataset.worldOpen) lockTo(0);
    };
    if (window.location.hash) reveal(window.location.hash);
    document.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [goTo, lockTo]);

  const chrome = CHROME[locale];
  const list = useMemo(() => hotspots, [hotspots]);
  const reading = open && open !== TRAVEL ? open : '';
  return (
    <>
      <nav
        aria-label={chrome.places}
        className="tx-world-hotspots"
        data-open={reading || undefined}
      >
        <ul>
          {list.map((spot) => (
            <li data-hotspot={spot.id} key={spot.id}>
              {spot.href ? (
                <a className="tx-world-spot" data-far href={spot.href}>
                  <span aria-hidden="true" className="tx-world-dot" />
                  <span className="tx-world-label">{spot.label}</span>
                </a>
              ) : (
                <button
                  aria-pressed={reading === spot.id}
                  className="tx-world-spot"
                  onClick={() => goTo(spot.id)}
                  type="button"
                >
                  <span aria-hidden="true" className="tx-world-dot" />
                  <span className="tx-world-label">{spot.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>
      {reading ? (
        <button
          aria-label={chrome.close}
          className="tx-world-close"
          onClick={() => lockTo(0)}
          ref={closeButton}
          type="button"
        >
          <span aria-hidden="true">←</span>
        </button>
      ) : null}
    </>
  );
}
