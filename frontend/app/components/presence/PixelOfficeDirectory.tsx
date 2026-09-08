'use client';

import * as React from 'react';

import { appearanceFor } from '@/components/presence/appearance';
import { PresenceSprite } from '@/components/presence/PresenceSprite';
import type { PresenceUser } from '@/types/presence';

/**
 * Right-hand sidebar of the pixel office: who is in the room, grouped by the pod they
 * stand in, plus the reactions soundboard. Colours come from the scoped
 * `.wakaclock-presence-theme` custom properties, not Tailwind tokens.
 */

const PRESENCE_BORDER = 'var(--presence-border)';
const PRESENCE_PANEL = 'var(--presence-panel)';
const PRESENCE_MUTED = 'var(--presence-text-muted)';
const PRESENCE_LIVE = 'var(--presence-live)';
const PRESENCE_DANGER = 'var(--presence-danger)';

const headingStyle: React.CSSProperties = { fontFamily: 'var(--font-presence-heading)' };
const MICRO_LABEL_CLASS = 'text-[10px] font-bold tracking-widest uppercase';
const BADGE_CLASS = 'presence-chip flex shrink-0 items-center gap-1 border-2 px-2 py-0.5';
const CARD_CLASS = 'presence-panel presence-pixel-shadow-sm border-2 p-3';

/** Picked per pod by hashing its id, so a zone keeps its colour with no server support. */
const ZONE_SWATCHES = ['#ff4438', '#28b65a', '#2f6df6', '#f5a524', '#9b5de5', '#00b8c4'];

type PresenceStatus = PresenceUser['status'];

const STATUS_BADGES = {
  coding: { glyph: '⚡', label: 'Coding' },
  idle: { glyph: '☕', label: 'Idle' },
  offline: { glyph: '·', label: 'Offline' },
} satisfies Record<PresenceStatus, { glyph: string; label: string }>;

const REACTIONS = [
  { emoji: '👏', label: 'Clap' },
  { emoji: '☕', label: 'Coffee break' },
  { emoji: '✋', label: 'Wave' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '❤️', label: 'Love it' },
];

const WANDERING_ID = 'wandering';
const TAB_IDS = ['pods', 'chat'] as const;

interface DirectoryZone {
  id: string;
  label: string;
}

interface DirectoryGroup {
  /** True occupancy, not the filtered count — a search must not make a pod look emptier. */
  count: number;
  id: string;
  label: string;
  occupants: PresenceUser[];
  swatch: string;
}

export interface PixelOfficeDirectoryProps {
  onReact?: (emoji: string) => void;
  reducedMotion: boolean;
  users: PresenceUser[];
  zones: DirectoryZone[];
}

function zoneSwatch(zoneId: string): string {
  let hash = 7;
  for (const character of zoneId) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 100_003;
  }
  return ZONE_SWATCHES[hash % ZONE_SWATCHES.length];
}

function matchesName(user: PresenceUser, needle: string): boolean {
  return needle.length === 0 || user.username.toLowerCase().includes(needle);
}

function buildGroups(zones: DirectoryZone[], users: PresenceUser[], needle: string) {
  const groups: DirectoryGroup[] = [];
  for (const zone of zones) {
    const occupants = users.filter((user) => user.zoneId === zone.id);
    // A pod-label hit keeps the whole pod; otherwise only the coworkers whose name matches.
    const labelHit = needle.length === 0 || zone.label.toLowerCase().includes(needle);
    const visible = labelHit ? occupants : occupants.filter((user) => matchesName(user, needle));
    if (needle.length === 0 || visible.length > 0) {
      groups.push({
        count: occupants.length,
        id: zone.id,
        label: zone.label,
        occupants: visible,
        swatch: zoneSwatch(zone.id),
      });
    }
  }
  const loose = users.filter((user) => user.zoneId == null);
  const wandering = loose.filter((user) => matchesName(user, needle));
  if (wandering.length > 0) {
    groups.push({
      count: loose.length,
      id: WANDERING_ID,
      label: 'Wandering',
      occupants: wandering,
      swatch: zoneSwatch(WANDERING_ID),
    });
  }
  return groups;
}

function StatusBadge({ pulse, status }: { pulse: boolean; status: PresenceStatus }) {
  const badge = STATUS_BADGES[status];
  const coding = status === 'coding';
  return (
    <span
      className={`${BADGE_CLASS} text-[10px] font-bold`}
      style={{
        borderColor: PRESENCE_BORDER,
        color: coding ? PRESENCE_LIVE : PRESENCE_MUTED,
        opacity: status === 'offline' ? 0.7 : 1,
      }}
    >
      <span aria-hidden>{badge.glyph}</span>
      {badge.label}
      {coding && pulse ? (
        <span
          aria-hidden
          className="presence-live-dot inline-block size-1.5 rounded-full"
          style={{ background: PRESENCE_LIVE }}
        />
      ) : null}
    </span>
  );
}

function PodGroup({ group, reducedMotion }: { group: DirectoryGroup; reducedMotion: boolean }) {
  return (
    <li className={CARD_CLASS} style={{ background: PRESENCE_PANEL, borderColor: PRESENCE_BORDER }}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-3 shrink-0 border-2"
          style={{ background: group.swatch, borderColor: PRESENCE_BORDER, borderRadius: 0 }}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-bold" style={headingStyle}>
          {group.label}
        </span>
        <span
          className={`${BADGE_CLASS} text-[10px] font-bold`}
          style={{ borderColor: PRESENCE_BORDER, color: PRESENCE_MUTED }}
        >
          {group.count} here
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {group.occupants.map((user) => (
          <li className="flex items-center justify-between gap-2" key={`${group.id}:${user.id}`}>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0">
                <PresenceSprite
                  {...appearanceFor(user.id)}
                  color={appearanceFor(user.id).shirtColor}
                  reducedMotion
                  size={32}
                  status={user.status}
                />
              </span>
              <span className="truncate text-xs font-bold">
                {user.isCurrentUser ? `${user.username} (you)` : user.username}
              </span>
            </span>
            <StatusBadge pulse={!reducedMotion} status={user.status} />
          </li>
        ))}
      </ul>
    </li>
  );
}

export function PixelOfficeDirectory({
  onReact,
  reducedMotion,
  users,
  zones,
}: PixelOfficeDirectoryProps) {
  const [tab, setTab] = React.useState<(typeof TAB_IDS)[number]>('pods');
  const [search, setSearch] = React.useState('');
  const needle = search.trim().toLowerCase();
  const groups = buildGroups(zones, users, needle);
  // Zero groups means either "nothing matched the search" or "this room has no pods yet" —
  // the second is reachable before the first snapshot lands, with no search term to quote.
  const emptyMessage =
    needle.length > 0
      ? `No coworker or pod matches “${search.trim()}”.`
      : 'No pods in this room yet.';

  return (
    <aside
      className="presence-panel presence-pixel-shadow flex h-full w-72 flex-col border-2"
      style={{ background: PRESENCE_PANEL, borderColor: PRESENCE_BORDER }}
    >
      <div className="flex shrink-0 border-b-2" style={{ borderColor: PRESENCE_BORDER }}>
        {TAB_IDS.map((id) => {
          const active = tab === id;
          return (
            <button
              aria-pressed={active}
              className={`flex-1 border-b-4 px-3 py-2 ${MICRO_LABEL_CLASS}`}
              key={id}
              onClick={() => setTab(id)}
              style={{
                ...headingStyle,
                borderColor: active ? PRESENCE_DANGER : 'transparent',
                // The theme rounds every button; a rounded-up underline reads as a pill,
                // not as the active-tab rule it needs to be.
                borderRadius: 0,
                color: active ? 'var(--presence-text)' : PRESENCE_MUTED,
              }}
              type="button"
            >
              {id === 'pods' ? `Pods (${zones.length})` : 'Chat'}
            </button>
          );
        })}
      </div>

      {tab === 'chat' ? (
        <p className="flex-1 p-4 text-xs" style={{ color: PRESENCE_MUTED }}>
          Chat is coming soon.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 p-3">
            <input
              aria-label="Search coworker or pod"
              className="presence-input h-9 w-full border-2 px-2 text-xs outline-none"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search coworker or pod…"
              style={{
                background: 'var(--presence-bg-soft)',
                borderColor: PRESENCE_BORDER,
                color: 'var(--presence-text)',
              }}
              value={search}
            />
          </div>
          {groups.length > 0 ? (
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
              {groups.map((group) => (
                <PodGroup group={group} key={group.id} reducedMotion={reducedMotion} />
              ))}
            </ul>
          ) : (
            <p className="flex-1 px-3 text-xs" style={{ color: PRESENCE_MUTED }}>
              {emptyMessage}
            </p>
          )}
        </div>
      )}

      <div className="shrink-0 border-t-2 p-3" style={{ borderColor: PRESENCE_BORDER }}>
        <p className={MICRO_LABEL_CLASS} style={{ ...headingStyle, color: PRESENCE_MUTED }}>
          Office reactions
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          {REACTIONS.map((reaction) => (
            <button
              aria-label={reaction.label}
              className="presence-pixel-shadow-sm presence-pixel-press flex size-9 items-center justify-center border-2 text-sm"
              key={reaction.label}
              onClick={() => onReact?.(reaction.emoji)}
              style={{ background: PRESENCE_PANEL, borderColor: PRESENCE_BORDER }}
              type="button"
            >
              <span aria-hidden>{reaction.emoji}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
