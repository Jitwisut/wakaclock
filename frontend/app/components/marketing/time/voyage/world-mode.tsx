'use client';

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NAV_LINKS } from '../../nav-links.data';
import { timeMotion } from '../time-store';

import { PLACE_ATTRIBUTE, PLACES, TOUR, tourIndex, tourStop } from './world-places';

/**
 * World mode: the homepage as an archipelago (owner decision 2026-11-14). It only ever
 * enhances the server-rendered page — every section stays in the HTML, in order. With
 * WebGL available, this component tags each section with the place it belongs to, hides
 * the long scroll and turns it into a tour: scrolling sails from place to place along a
 * route and, when the scroll rests, locks onto the nearest one and shows its title card —
 * the place's own heading and a button that opens its sections in a reading panel. A compass
 * shows the way and jumps to any place. Without WebGL (or with reduced motion) it never
 * mounts and the page reads top to bottom as before.
 *
 * Hotspot labels are the page's own headings and nav links, read at runtime.
 */

/** UI chrome for the panel; rendered on the client only, never part of the page copy. */
const CHROME = {
  en: {
    close: 'Close the log',
    compass: 'Voyage compass',
    home: 'Back to the map',
    hint: 'Scroll to sail on',
    open: 'Open the log',
    places: 'Places',
    start: 'Scroll to set sail',
  },
  th: {
    close: 'ปิดบันทึก',
    compass: 'เข็มทิศการเดินทาง',
    home: 'กลับสู่แผนที่',
    hint: 'เลื่อนเพื่อเดินทางต่อ',
    open: 'เปิดอ่าน',
    places: 'สถานที่',
    start: 'เลื่อนเพื่อออกเรือ',
  },
} as const;

const HOME = '#tx-c0';
/** Shown while the camera is between places: no section belongs to it. */
const TRAVEL = 'travel';
/** Wheel distance (px) from one stop to the next. */
const STOP_PIXELS = 1500;
/** How far the scroll must leave a stop before it commits to the next one. */
const COMMIT = 0.18;
/** Quiet time after the last scroll input before the tour locks onto a stop. */
const SETTLE_MS = 240;
/** Time the camera gets to arrive before a linked-to place opens by itself. */
const ARRIVE_MS = 1100;

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
  /** The place whose panel is open ('' = none). */
  const [open, setOpen] = useState('');
  /** The stop the tour is locked onto (0 = the map) and whether the scroll has left it. */
  const [stop, setStop] = useState(0);
  const [moving, setMoving] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [locale, setLocale] = useState<'en' | 'th'>('en');
  const frame = useRef<HTMLElement | null>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const lastOpen = useRef('');
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
      delete site.dataset.worldAt;
      timeMotion.world = false;
      timeMotion.place = '';
      timeMotion.tour = 0;
      timeMotion.tourTarget = 0;
      window.clearTimeout(settleTimer.current);
      window.clearTimeout(openTimer.current);
      for (const element of site.querySelectorAll<HTMLElement>(`[${PLACE_ATTRIBUTE}]`)) {
        element.removeAttribute(PLACE_ATTRIBUTE);
        delete element.dataset.worldOpen;
      }
    };
  }, [rootId]);

  const atHome = stop === 0 && !moving;
  /** The place the tour rests at with its title card up (no panel open yet). */
  const arrived = !moving && !open ? tourStop(stop) : '';

  // Show what the tour is on: the hero on the map, a place's sections when its panel is
  // open, nothing while sailing or while a title card is up.
  useEffect(() => {
    const site = frame.current;
    if (!site) return;
    const shown = open || (atHome ? 'home' : TRAVEL);
    for (const element of site.querySelectorAll<HTMLElement>(`[${PLACE_ATTRIBUTE}]`)) {
      if (element.getAttribute(PLACE_ATTRIBUTE) === shown) element.dataset.worldOpen = '';
      else delete element.dataset.worldOpen;
    }
    site.dataset.worldOpen = open || (atHome ? '' : TRAVEL);
    site.dataset.worldAt = arrived;
    timeMotion.place = open;
    if (!open) {
      // The panel closed: return keyboard focus to the button that opened it.
      if (lastOpen.current) openButton.current?.focus({ preventScroll: true });
      lastOpen.current = '';
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
  }, [arrived, atHome, open]);

  /**
   * Locks the tour onto a stop: the ship and the camera glide there and the place's title
   * card comes up. `thenOpen` also opens its panel once the camera has had time to arrive
   * (an in-page link asked for that content).
   */
  const lockTo = useCallback((index: number, thenOpen = false) => {
    const next = Math.min(TOUR.length, Math.max(0, index));
    base.current = next;
    timeMotion.tourTarget = next;
    window.clearTimeout(settleTimer.current);
    window.clearTimeout(openTimer.current);
    setStop(next);
    setMoving(false);
    const id = tourStop(next);
    setOpen((current) => (current === id ? current : ''));
    if (thenOpen && id) openTimer.current = window.setTimeout(() => setOpen(id), ARRIVE_MS);
  }, []);

  const goTo = useCallback(
    (id: string, thenOpen = false) =>
      lockTo(id === 'home' ? 0 : Math.max(0, tourIndex(id)), thenOpen),
    [lockTo]
  );

  // The scroll tour: wheel, touch and keys move along the route; when the input rests the
  // tour locks onto the nearest stop the gesture committed to.
  useEffect(() => {
    const site = frame.current;
    if (!site) return;
    let touchY: null | number = null;
    let touching = false;

    const settle = () => {
      const from = base.current;
      const moved = timeMotion.tourTarget - from;
      let next = from;
      if (moved > COMMIT) next = Math.ceil(timeMotion.tourTarget);
      else if (moved < -COMMIT) next = Math.floor(timeMotion.tourTarget);
      // Past the middle of a crossing the nearer shore wins.
      if (Math.abs(moved) > 1) next = Math.round(timeMotion.tourTarget);
      lockTo(next);
    };
    const advance = (amount: number) => {
      const next = Math.min(TOUR.length, Math.max(0, timeMotion.tourTarget + amount));
      if (next === timeMotion.tourTarget) return;
      timeMotion.tourTarget = next;
      window.clearTimeout(openTimer.current);
      // Leaving a place closes it; the map's hero goes the same way.
      if (Math.abs(next - base.current) > COMMIT) {
        setMoving(true);
        setOpen('');
      }
      window.clearTimeout(settleTimer.current);
      if (!touching) settleTimer.current = window.setTimeout(settle, SETTLE_MS);
    };
    /**
     * Input over an open reading panel belongs to the panel, whether or not it has more to
     * scroll: reading must never sail the visitor away. The voyage continues from the scene
     * beside the panel, the compass, the keys or the close button.
     */
    const heldByPanel = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      const reading = site.dataset.worldOpen && site.dataset.worldOpen !== TRAVEL;
      return Boolean(reading && element?.closest('.tx-chapters, .tx-day'));
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const pixels = event.deltaMode === 1 ? event.deltaY * 32 : event.deltaY;
      if (heldByPanel(event.target)) return;
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
      if (heldByPanel(event.target)) return;
      advance(moved / (window.innerHeight * 1.1));
    };
    const onTouchEnd = () => {
      touching = false;
      touchY = null;
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(settle, 80);
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
        // With the panel open the arrow keys read it; they do not leave the island.
        if (heldByPanel(document.activeElement)) return;
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

  // In-page links (#features, #faq, the rail…) sail to the place that holds their target
  // and open it there.
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
      pendingTarget.current = target;
      goTo(holder.getAttribute(PLACE_ATTRIBUTE) ?? 'home', true);
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
      if (event.key !== 'Escape') return;
      // Escape steps back one level: the panel, then the island.
      if (site.dataset.worldOpen && site.dataset.worldOpen !== TRAVEL) setOpen('');
      else if (base.current > 0) lockTo(0);
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
  const stops = useMemo(
    () => TOUR.map((id) => hotspots.find((spot) => spot.id === id)).filter(Boolean),
    [hotspots]
  );
  const card = hotspots.find((spot) => spot.id === arrived);
  const total = String(TOUR.length).padStart(2, '0');
  return (
    <>
      <nav aria-label={chrome.places} className="tx-world-hotspots" data-open={open || undefined}>
        <ul>
          {hotspots.map((spot) => (
            <li
              data-current={spot.id === arrived || undefined}
              data-hotspot={spot.id}
              key={spot.id}
            >
              {spot.href ? (
                <a className="tx-world-spot" data-far href={spot.href}>
                  <span aria-hidden="true" className="tx-world-dot" />
                  <span className="tx-world-label">{spot.label}</span>
                </a>
              ) : (
                <button
                  aria-pressed={open === spot.id}
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

      {/* Decoration the scene drives every frame: the spyglass iris and the tether that ties
          a title card or a panel to its landmark. */}
      <div aria-hidden="true" className="tx-world-spyglass" />
      <div aria-hidden="true" className="tx-world-tether" />

      {/* The title card: the place's own heading and the way in. */}
      {card ? (
        <div className="tx-world-card" data-tether key={card.id}>
          <p className="tx-world-card-index">
            <span>{String(stop).padStart(2, '0')}</span> / {total}
          </p>
          <p className="tx-world-card-title">{card.label}</p>
          <button
            className="tx-world-card-open"
            onClick={() => setOpen(card.id)}
            ref={openButton}
            type="button"
          >
            {chrome.open}
            <span aria-hidden="true">→</span>
          </button>
          <p aria-hidden="true" className="tx-world-card-hint">
            {chrome.hint}
          </p>
        </div>
      ) : null}

      {/* The compass: where the voyage is, which way the next place lies, and a way to
          jump to any of them. */}
      <nav aria-label={chrome.compass} className="tx-world-compass" data-home={atHome || undefined}>
        <div aria-hidden="true" className="tx-world-compass-ring" />
        <div aria-hidden="true" className="tx-world-compass-needle" />
        <ol>
          {stops.map((spot, index) => (
            <li key={spot.id} style={{ '--i': index + 1, '--n': TOUR.length + 1 } as CSSProperties}>
              <button
                aria-current={stop === index + 1 && !moving ? 'step' : undefined}
                aria-label={spot.label}
                onClick={() => goTo(spot.id)}
                title={spot.label}
                type="button"
              />
            </li>
          ))}
        </ol>
        <button
          aria-label={chrome.home}
          className="tx-world-compass-home"
          onClick={() => lockTo(0)}
          title={chrome.home}
          type="button"
        >
          {atHome ? 'N' : String(stop).padStart(2, '0')}
        </button>
        {atHome ? (
          <p aria-hidden="true" className="tx-world-compass-hint">
            {chrome.start}
          </p>
        ) : null}
      </nav>

      {open ? (
        <button
          aria-label={chrome.close}
          className="tx-world-close"
          data-tether
          onClick={() => setOpen('')}
          type="button"
        >
          <span aria-hidden="true">←</span>
        </button>
      ) : null}
    </>
  );
}
