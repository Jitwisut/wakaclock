import type * as React from 'react';

import { DoorOpenIcon, MonitorIcon } from 'lucide-react';

import type { PresenceRoom } from '@/types/presence';

const headingStyle: React.CSSProperties = { fontFamily: 'var(--font-presence-heading)' };
const PRESENCE_BORDER = 'var(--presence-border)';
const PRESENCE_PANEL = 'var(--presence-panel)';
const PRESENCE_TEXT_MUTED = 'var(--presence-text-muted)';

export function RoomStatusCard({ onLeave, room }: { onLeave: () => void; room: PresenceRoom }) {
  return (
    <div
      className="presence-panel presence-pixel-shadow flex flex-wrap items-center justify-between gap-4 border-2 p-5"
      style={{ background: PRESENCE_PANEL, borderColor: PRESENCE_BORDER }}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center border-2"
          style={{ background: 'var(--presence-bg-soft)', borderColor: PRESENCE_BORDER }}
        >
          <MonitorIcon className="size-6" style={{ color: PRESENCE_BORDER }} />
        </span>
        <div>
          <h2 className="text-lg font-bold" style={headingStyle}>
            {room.name}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-bold">
            {room.isLive ? (
              <>
                <span
                  aria-hidden
                  className="presence-live-dot inline-block size-2 rounded-full"
                  style={{ background: 'var(--presence-live)' }}
                />
                <span style={{ color: 'var(--presence-live)' }}>Live</span>
              </>
            ) : (
              <span style={{ color: PRESENCE_TEXT_MUTED }}>Reconnecting…</span>
            )}
            <span aria-hidden style={{ color: PRESENCE_TEXT_MUTED }}>
              ·
            </span>
            <span>{room.memberCount} here</span>
          </p>
        </div>
      </div>

      <button
        aria-label="Leave room"
        className="presence-pixel-shadow-sm presence-pixel-press flex items-center gap-1.5 border-2 px-4 py-2.5 text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        onClick={onLeave}
        style={{ background: PRESENCE_PANEL, borderColor: PRESENCE_BORDER }}
        type="button"
      >
        <DoorOpenIcon aria-hidden className="size-4" />
        Leave
      </button>
    </div>
  );
}
