import type * as React from 'react';

import { ConstructionIcon } from 'lucide-react';

import type { PresenceState } from '@/lib/wakaclock/types';

const border = 'var(--presence-border)';
const panel = 'var(--presence-panel)';
const muted = 'var(--presence-text-muted)';
const live = 'var(--presence-live)';
const headingStyle: React.CSSProperties = { fontFamily: 'var(--font-presence-heading)' };

interface PresenceHeaderProps {
  connectionLabel?: null | string;
  onLockedFeature: (label: string) => void;
  partyCount?: null | number;
  presenceState?: null | PresenceState;
  roomName?: null | string;
  username?: null | string;
}

const STATE_LABEL: Record<PresenceState, string> = {
  coding: '🎧 Deep focus',
  idle: '☕ Idle',
  offline: '· Away',
};

const STATE_COLOR: Record<PresenceState, string> = {
  coding: live,
  idle: '#b7791f',
  offline: muted,
};

function Chip({
  children,
  tone = 'panel',
}: {
  children: React.ReactNode;
  tone?: 'panel' | 'soft';
}) {
  return (
    <span
      className="presence-pixel-shadow-sm inline-flex items-center gap-1.5 border-2 px-2.5 py-1 text-[10px] font-bold"
      style={{
        background: tone === 'soft' ? 'var(--presence-bg-soft)' : panel,
        borderColor: border,
      }}
    >
      {children}
    </span>
  );
}

export function PresenceHeader({
  connectionLabel,
  onLockedFeature,
  partyCount,
  presenceState,
  roomName,
  username,
}: PresenceHeaderProps) {
  return (
    <header
      className="presence-pixel-shadow mb-4 flex flex-wrap items-center justify-between gap-3 border-2 p-3"
      style={{ background: 'var(--presence-bg-soft)', borderColor: border }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          aria-hidden
          className="presence-pixel-shadow-sm flex size-9 items-center justify-center border-2 text-base"
          style={{ background: panel, borderColor: border }}
        >
          👾
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold tracking-wide" style={headingStyle}>
              PixelOffice
            </span>
            <span
              className="border px-1 py-0.5 text-[8px] font-bold"
              style={{ borderColor: live, color: live }}
            >
              16-BIT
            </span>
          </div>
          <h1 className="mt-0.5 text-[11px] font-bold" style={{ color: muted }}>
            Coding presence
          </h1>
        </div>

        {roomName ? (
          <Chip tone="soft">
            <span aria-hidden>🏰</span>
            <span className="max-w-[12rem] truncate">{roomName}</span>
            {connectionLabel ? (
              <span style={{ color: connectionLabel === 'Live' ? live : muted }}>
                · {connectionLabel}
              </span>
            ) : null}
          </Chip>
        ) : null}
      </div>

      <p
        className="hidden max-w-sm text-[10px] font-bold lg:block"
        style={{ color: muted, ...headingStyle }}
      >
        ⚡ SPATIAL AUDIO · walk your sprite into a pod to co-work — proximity is the
        whole interaction
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {typeof partyCount === 'number' ? (
          <Chip>
            <span
              className="presence-live-dot size-1.5 rounded-full"
              style={{ background: live }}
            />
            <span style={{ color: live }}>{partyCount} here</span>
          </Chip>
        ) : null}

        <button
          className="presence-pixel-shadow-sm presence-pixel-press inline-flex items-center gap-1.5 border-2 px-2.5 py-1 text-[10px] font-bold"
          onClick={() => onLockedFeature('Floors')}
          style={{ background: panel, borderColor: border }}
          type="button"
        >
          <span aria-hidden>🗺️</span> Floors
        </button>

        {username ? (
          <span
            className="presence-pixel-shadow-sm inline-flex items-center gap-2 border-2 px-2 py-1"
            style={{ background: panel, borderColor: border }}
          >
            <span
              aria-hidden
              className="flex size-6 items-center justify-center border text-xs"
              style={{ borderColor: border }}
            >
              🧑‍💻
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[10px] font-bold">{username}</span>
              {presenceState ? (
                <span
                  className="block text-[9px] font-bold"
                  style={{ color: STATE_COLOR[presenceState] }}
                >
                  {STATE_LABEL[presenceState]}
                </span>
              ) : null}
            </span>
          </span>
        ) : (
          <Chip>
            <ConstructionIcon aria-hidden className="size-3" style={{ color: 'var(--presence-danger)' }} />
            Prototype
          </Chip>
        )}
      </div>
    </header>
  );
}
