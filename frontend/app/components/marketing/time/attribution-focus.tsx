'use client';

import { setTimeUi, type TimeFocus, useTimeUi } from './time-store';

import type { TimeCopyShape } from './time-copy';

const ORDER: TimeFocus[] = ['all', 'human', 'ai', 'unattributed'];
const CARDS: Exclude<TimeFocus, 'all'>[] = ['human', 'ai', 'unattributed'];

/**
 * Focus control for chapter 04. All three kinds stay readable as plain cards (nothing is
 * hidden without JavaScript); the buttons only choose which kind the ring lights up and
 * which card is emphasised.
 */
export function AttributionFocus({
  controlsLabel,
  kinds,
}: {
  controlsLabel: string;
  kinds: TimeCopyShape['humanAi']['kinds'];
}) {
  const focus = useTimeUi((state) => state.focus);

  return (
    <div className="tx-focus" data-reveal>
      <div aria-label={controlsLabel} className="tx-segmented" role="group">
        {ORDER.map((kind) => (
          <button
            aria-pressed={focus === kind}
            data-kind={kind}
            key={kind}
            onClick={() => setTimeUi({ focus: kind })}
            type="button"
          >
            <span aria-hidden="true" className="tx-swatch" data-kind={kind} />
            {kinds[kind].label}
          </button>
        ))}
      </div>
      <ul className="tx-kinds">
        {CARDS.map((kind) => (
          <li data-dim={focus !== 'all' && focus !== kind} data-kind={kind} key={kind}>
            <h3 className="tx-h4">
              <span aria-hidden="true" className="tx-swatch" data-kind={kind} />
              {kinds[kind].title}
            </h3>
            <p className="tx-body">{kinds[kind].body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
