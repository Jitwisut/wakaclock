'use client';

import * as React from 'react';

import { useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';

import type { AuthMode } from '@/components/auth/auth-form';
import { TimeCoreDial } from '@/components/wakaclock/time-core/time-core-dial';
import { supportsWebGL } from '@/components/wakaclock/time-core/webgl';
import { buildTimeCore } from '@/lib/wakaclock/time-core';
import type { DurationBlock } from '@/lib/wakaclock/types';

const TimeCoreScene = dynamic(() => import('@/components/wakaclock/time-core/time-core-scene'), {
  ssr: false,
});

/*
 * The Cinema sign-in stage: the Time Core turning slowly over an illustrative day, so the
 * first thing a visitor sees is the shape of what the dashboard will show them. Every arc
 * here is a fixed sample — it is labelled as such and never reads anyone's data.
 */

const SAMPLE_START = Date.UTC(2026, 0, 5) / 1000;
const SAMPLE_SESSIONS: [project: string, startHour: number, minutes: number][] = [
  ['api', 8.6, 70],
  ['web', 10.2, 95],
  ['api', 13.5, 45],
  ['web', 14.6, 80],
  ['docs', 16.4, 35],
  ['web', 20.2, 50],
];

/** The illustrative day the stage draws; exported so it can be checked for honesty. */
export const SAMPLE_DAY = buildTimeCore({
  data: SAMPLE_SESSIONS.map(([project, hour, minutes]): DurationBlock => {
    const start = SAMPLE_START + Math.round(hour * 3600);
    return {
      category: 'coding',
      duration_seconds: minutes * 60,
      end: start + minutes * 60,
      entity: project,
      heartbeat_count: 1,
      language: null,
      project,
      start,
    };
  }),
  date: '2026-01-05',
  range_end: SAMPLE_START + 86_400,
  range_start: SAMPLE_START,
  total: SAMPLE_SESSIONS.length,
});

const FACTS = [
  ['Never collected', 'File contents, prompts, AI responses'],
  ['Always kept', 'Your complete history, in the base plan'],
  ['Counted apart', 'AI lines, human keystrokes, unattributed'],
] as const;

const NO_ARC = () => {};

export function CinemaAuthStage({ mode }: { mode: AuthMode }) {
  const [webgl, setWebgl] = React.useState(false);
  const reducedMotion = Boolean(useReducedMotion());
  const overlay = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setWebgl(supportsWebGL()), []);

  return (
    <aside
      aria-labelledby="auth-panel-heading"
      className="relative isolate hidden min-h-screen flex-col justify-between overflow-hidden bg-(--stage) px-12 py-12 text-(--stage-foreground) lg:flex"
      data-slot="cinema-auth-stage"
    >
      <div className="relative z-10 flex items-baseline justify-between gap-6">
        <div>
          <p
            className="font-display text-xl font-medium tracking-[-0.03em]"
            id="auth-panel-heading"
          >
            AtoAxis
          </p>
          <p className="cinema-label mt-1.5 text-(--stage-muted)!">Developer time tracking</p>
        </div>
        <p className="cinema-label text-(--stage-muted)!">
          {mode === 'register' ? 'Scene 00 · First day' : 'Scene 00 · Welcome back'}
        </p>
      </div>

      <div aria-hidden className="absolute inset-0 top-24 bottom-48">
        {webgl ? (
          <>
            <TimeCoreScene
              active={!reducedMotion}
              exploded={false}
              focusedRing={null}
              model={SAMPLE_DAY}
              onHover={NO_ARC}
              onSelect={NO_ARC}
              overlay={overlay}
              reducedMotion={reducedMotion}
              selectedArcId={null}
            />
            <div className="pointer-events-none absolute inset-0" ref={overlay} />
          </>
        ) : (
          <TimeCoreDial focusedRing={null} model={SAMPLE_DAY} />
        )}
      </div>

      <div className="relative z-10">
        <p className="font-display max-w-md text-[length:clamp(2rem,3vw,3rem)] leading-[1.02] font-medium tracking-[-0.04em] text-balance">
          Every hour, <span className="cinema-serif text-(--primary-400)">accounted for.</span>
        </p>
        <p className="cinema-label mt-3 text-(--stage-muted)!">
          Illustrative sample day · not your data
        </p>
        <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-(--stage-line) pt-6 text-sm">
          {FACTS.map(([term, description]) => (
            <div key={term}>
              <dt className="cinema-label text-(--stage-muted)!">{term}</dt>
              <dd className="mt-2 leading-snug">{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
