'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon, Layers3Icon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';

import { QueryState } from '@/components/wakaclock/query-state';
import { getDurations } from '@/lib/wakaclock/endpoints';
import { formatSeconds, todayDateString } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { buildTimeCore, type TimeCoreArc, type TimeCoreModel } from '@/lib/wakaclock/time-core';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { TimeCoreDial } from './time-core-dial';
import styles from './time-core.module.css';

const TimeCoreScene = dynamic(() => import('./time-core-scene'), { ssr: false });

const EASE = [0.16, 1, 0.3, 1] as const;

/** True when this browser can create a WebGL context. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Whether the stage should animate: on screen and in a visible tab. Off screen or in a
 * background tab the scene drops to on-demand rendering, so an idle dashboard does no
 * GPU work.
 */
function useStageActive(ref: React.RefObject<HTMLElement | null>) {
  const [onScreen, setOnScreen] = React.useState(false);
  const [tabVisible, setTabVisible] = React.useState(true);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.15,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  React.useEffect(() => {
    const update = () => setTabVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return onScreen && tabVisible;
}

function clock(epochSeconds: number) {
  return format(new Date(epochSeconds * 1000), 'HH:mm');
}

function Inspector({ arc, color }: { arc: null | TimeCoreArc; color: null | string }) {
  return (
    <div aria-live="polite" className={styles.inspector} data-testid="time-core-inspector">
      {arc ? (
        <>
          <span className="cinema-label">Session</span>
          <strong className={styles.inspectorProject}>
            <i aria-hidden style={{ background: color ?? undefined }} />
            {arc.project}
          </strong>
          <span className={styles.inspectorTime}>
            {clock(arc.start)} – {clock(arc.end)}
          </span>
          <span className={styles.inspectorDuration}>{formatSeconds(arc.durationSeconds)}</span>
        </>
      ) : (
        <span className={styles.inspectorHint}>Hover or select a session to inspect it.</span>
      )}
    </div>
  );
}

function Attribution({ model }: { model: TimeCoreModel }) {
  const split = model.attribution;
  if (!split) return null;
  const sum = split.humanOnlySeconds + split.overlapSeconds + split.aiOnlySeconds;
  if (sum <= 0) return null;
  const parts = [
    { key: 'human', label: 'Human only', seconds: split.humanOnlySeconds },
    { key: 'both', label: 'Human + AI', seconds: split.overlapSeconds },
    { key: 'ai', label: 'AI only', seconds: split.aiOnlySeconds },
  ];
  return (
    <div className={styles.attribution}>
      <span className="cinema-label">Measured active · who was working</span>
      <div aria-hidden className={styles.attributionBar}>
        {parts.map((part) => (
          <span
            data-part={part.key}
            key={part.key}
            style={{ flexGrow: part.seconds, flexBasis: 0 }}
          />
        ))}
      </div>
      <dl className={styles.attributionLegend}>
        {parts.map((part) => (
          <div data-part={part.key} key={part.key}>
            <dt>{part.label}</dt>
            <dd>{formatSeconds(part.seconds)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Scene 01 of the Cinema overview: the selected day as a 3D Time Core beside its numbers.
 * The stage stays dark in light mode — a lit set inside the printed page.
 */
export function TimeCore() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [date, setDate] = React.useState(todayDateString());
  const [timezone, setTimezone] = React.useState<null | string>(null);
  const [exploded, setExploded] = React.useState(false);
  const [hovered, setHovered] = React.useState<null | TimeCoreArc>(null);
  const [selected, setSelected] = React.useState<null | TimeCoreArc>(null);
  const [focusedRing, setFocusedRing] = React.useState<null | number>(null);
  const [webgl, setWebgl] = React.useState<boolean | null>(null);
  const reducedMotion = Boolean(useReducedMotion());
  const stage = React.useRef<HTMLElement>(null);
  const overlay = React.useRef<HTMLDivElement>(null);
  const onStage = useStageActive(stage);

  React.useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    setWebgl(supportsWebGL());
  }, []);

  const { data, error, isLoading } = useQuery({
    queryKey: wakaclockKeys.durations(userId, date, timezone ?? undefined),
    // Same key as the Sessions panel, so both read one cached response.
    queryFn: () => getDurations(userId, date, timezone as string),
    enabled: Boolean(userId && timezone),
  });

  const model = React.useMemo(() => (data ? buildTimeCore(data) : null), [data]);
  const today = todayDateString();
  const moveDay = (days: number) => {
    setSelected(null);
    setHovered(null);
    setDate((current) => format(addDays(parseISO(current), days), 'yyyy-MM-dd'));
  };
  const inspected = hovered ?? selected;
  const inspectedColor =
    model?.rings.find((ring) => ring.arcs.some((arc) => arc.id === inspected?.id))?.cssColor ??
    null;
  const projectCount = model?.rings.length ?? 0;
  const empty = model !== null && model.totalSeconds === 0;
  const dayLabel = date === today ? 'Today' : format(parseISO(date), 'EEEE');

  return (
    <section aria-labelledby="time-core-title" className={styles.stage} ref={stage}>
      <div className={styles.copy}>
        <p className="cinema-label" id="time-core-kicker">
          Scene 01 · {dayLabel} · {format(parseISO(date), 'd MMM yyyy')}
        </p>
        <h2 className={styles.srOnly} id="time-core-title">
          Time Core — {dayLabel}
        </h2>
        <QueryState
          error={error}
          isLoading={timezone === null || isLoading}
          skeletonClassName="h-48 w-full bg-white/5"
        >
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            key={date}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <p className={styles.total} data-testid="time-core-total">
              {formatSeconds(model?.totalSeconds ?? 0)}
            </p>
            <p className={styles.totalCaption}>
              <span className="cinema-serif">of activity</span> with timeout
            </p>
          </motion.div>
          <dl className={styles.metrics}>
            <div>
              <dt className="cinema-label">Sessions</dt>
              <dd>{model?.sessionCount ?? 0}</dd>
            </div>
            <div>
              <dt className="cinema-label">Projects</dt>
              <dd>{projectCount}</dd>
            </div>
            <div>
              <dt className="cinema-label">Measured active</dt>
              <dd>
                {model?.measuredActiveSeconds == null
                  ? 'Not available'
                  : formatSeconds(model.measuredActiveSeconds)}
              </dd>
            </div>
          </dl>
          {model && <Attribution model={model} />}
          {model && model.rings.length > 0 && (
            <ul aria-label="Projects on the dial" className={styles.legend}>
              {model.rings.map((ring, index) => (
                <li key={ring.label}>
                  <button
                    aria-pressed={focusedRing === index}
                    className={styles.legendItem}
                    onBlur={() => setFocusedRing(null)}
                    onClick={() => setFocusedRing((current) => (current === index ? null : index))}
                    onFocus={() => setFocusedRing(index)}
                    onMouseEnter={() => setFocusedRing(index)}
                    onMouseLeave={() => setFocusedRing(null)}
                    type="button"
                  >
                    <span aria-hidden className={styles.legendIndex}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <i aria-hidden style={{ background: ring.cssColor }} />
                    <span className={styles.legendName}>{ring.label}</span>
                    <span className={styles.legendValue}>{formatSeconds(ring.totalSeconds)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {model && model.hiddenSeconds > 0 && (
            <p className={styles.note}>
              {formatSeconds(model.hiddenSeconds)} outside any project is counted in the total and
              not drawn on the dial.
            </p>
          )}
        </QueryState>
      </div>

      <div className={styles.viewport}>
        <div className={styles.hudTop}>
          <span className="cinema-label">Time Core · 24h dial</span>
          <span className="cinema-label">{timezone ?? '—'}</span>
        </div>
        <div className={styles.canvas} data-testid="time-core-canvas">
          {webgl && model ? (
            <>
              <TimeCoreScene
                active={onStage && !reducedMotion}
                exploded={exploded}
                focusedRing={focusedRing}
                model={model}
                onHover={setHovered}
                onSelect={(arc) => setSelected((current) => (current?.id === arc.id ? null : arc))}
                overlay={overlay}
                reducedMotion={reducedMotion}
                selectedArcId={selected?.id ?? null}
              />
              <div aria-hidden className={styles.labels} ref={overlay}>
                {[0, 6, 12, 18].map((hour) => (
                  <span className="time-core-hour" data-anchor={`hour:${hour}`} key={hour}>
                    {String(hour).padStart(2, '0')}
                  </span>
                ))}
                {exploded &&
                  model.rings.map((ring, index) => (
                    <span
                      className="time-core-layer-label"
                      data-anchor={`ring:${index}`}
                      key={ring.label}
                    >
                      {ring.label}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <TimeCoreDial focusedRing={focusedRing} model={model} />
          )}
          {empty && <p className={styles.emptyNote}>No recorded activity on this day.</p>}
        </div>
        <div className={styles.hudBottom}>
          <div className={styles.dayNav}>
            <button aria-label="Previous day" onClick={() => moveDay(-1)} type="button">
              <ChevronLeftIcon aria-hidden />
            </button>
            <span className={styles.dayNavLabel}>{format(parseISO(date), 'EEE d MMM')}</span>
            <button
              aria-label="Next day"
              disabled={date >= today}
              onClick={() => moveDay(1)}
              type="button"
            >
              <ChevronRightIcon aria-hidden />
            </button>
          </div>
          {webgl && (
            <button
              aria-pressed={exploded}
              className={styles.explode}
              disabled={!model || model.rings.length === 0}
              onClick={() => setExploded((value) => !value)}
              type="button"
            >
              <Layers3Icon aria-hidden />
              {exploded ? 'Assemble' : 'Explode layers'}
            </button>
          )}
          <Inspector arc={inspected} color={inspectedColor} />
        </div>
      </div>
    </section>
  );
}
