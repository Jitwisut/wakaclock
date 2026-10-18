'use client';

import { formatClock } from './time-keyframes';
import { useTimeUi } from './time-store';

import type { SliceKind } from './time-data';

/** Tooltip for the slice of today under the pointer: its time, its kind, and "demo". */
export function HoverTip({ demo, labels }: { demo: string; labels: Record<SliceKind, string> }) {
  const hover = useTimeUi((state) => state.hover);
  if (!hover) return null;
  return (
    <div
      aria-hidden="true"
      className="tx-tip"
      data-kind={hover.kind}
      style={{ transform: `translate(${hover.x + 18}px, ${hover.y + 18}px)` }}
    >
      <span className="tx-tip-time">
        {formatClock(hover.minute)}–{formatClock(hover.minute + 5)}
      </span>
      <span className="tx-tip-kind">
        <i aria-hidden="true" className="tx-swatch" data-kind={hover.kind} />
        {labels[hover.kind]}
      </span>
      <span className="tx-tip-demo">{demo}</span>
    </div>
  );
}
