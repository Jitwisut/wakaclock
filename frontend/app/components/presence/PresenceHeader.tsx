import type * as React from 'react';

import { ConstructionIcon, MessageCircleHeart } from 'lucide-react';

const headingStyle: React.CSSProperties = { fontFamily: 'var(--font-presence-heading)' };

export function PresenceHeader() {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="presence-pixel-shadow-sm flex size-11 shrink-0 items-center justify-center border-2"
          style={{ background: 'var(--presence-panel)', borderColor: 'var(--presence-border)' }}
        >
          <MessageCircleHeart className="size-5" style={{ color: 'var(--presence-danger)' }} />
        </span>
        <div>
          <h1 className="text-lg leading-relaxed font-bold sm:text-2xl" style={headingStyle}>
            Coding presence
          </h1>
          <p className="mt-2 max-w-xl text-sm" style={{ color: 'var(--presence-text-muted)' }}>
            See who&apos;s actually coding right now — driven by real activity, not a status
            anyone sets.
          </p>
        </div>
      </div>

      <span
        className="presence-pixel-shadow-sm inline-flex shrink-0 items-center gap-1.5 border-2 px-3 py-1.5 text-xs font-bold"
        style={{ background: 'var(--presence-panel)', borderColor: 'var(--presence-border)' }}
      >
        <ConstructionIcon aria-hidden className="size-3.5" style={{ color: 'var(--presence-danger)' }} />
        Prototype
      </span>
    </div>
  );
}
