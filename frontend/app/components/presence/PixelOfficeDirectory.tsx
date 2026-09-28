'use client';

import * as React from 'react';

import { MessageSquareIcon, SearchIcon, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { appearanceFor } from '@/components/presence/appearance';
import { PresenceSprite } from '@/components/presence/PresenceSprite';
import {
  countStates,
  formatPresenceDuration,
  PRESENCE_STATES,
  PRESENCE_STATUS,
} from '@/lib/presence/presence-status';
import type { PresenceState, PresenceV2Session } from '@/lib/wakaclock/types';
import type { PresenceUser } from '@/types/presence';

import styles from './presence-chrome.module.css';

/**
 * The live roster: everyone in the room, grouped by the pod they stand in, with a real
 * name search and status filter. Every field shown comes from the room snapshot —
 * username, live state, pod, and the co-working session a member is part of. The
 * roster deliberately carries no project, editor or file data.
 */

/** Picked per pod by hashing its id, so a zone keeps its colour with no server support. */
const ZONE_SWATCHES = ['#ff6b61', '#3ddc84', '#6f8bff', '#f5b54a', '#b48cff', '#34d1dc'];

const REACTIONS = [
  { emoji: '👏', label: 'Clap' },
  { emoji: '☕', label: 'Coffee break' },
  { emoji: '✋', label: 'Wave' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '❤️', label: 'Love it' },
];

const WANDERING_ID = 'wandering';

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
  onChat?: () => void;
  onReact?: (emoji: string) => void;
  reducedMotion: boolean;
  /** Server clock from the latest snapshot, so session timers agree with the server. */
  serverTime?: number;
  sessions?: PresenceV2Session[];
  users: PresenceUser[];
  zones: DirectoryZone[];
}

export function zoneSwatch(zoneId: string): string {
  let hash = 7;
  for (const character of zoneId) {
    hash = (hash * 31 + Number(character.codePointAt(0))) % 100_003;
  }
  return ZONE_SWATCHES[hash % ZONE_SWATCHES.length];
}

export function buildGroups(
  zones: DirectoryZone[],
  users: PresenceUser[],
  needle: string,
  status: null | PresenceState = null
) {
  const matches = (user: PresenceUser) =>
    (status === null || user.status === status) &&
    (needle.length === 0 || user.username.toLowerCase().includes(needle));
  const groups: DirectoryGroup[] = [];
  for (const zone of zones) {
    const occupants = users.filter((user) => user.zoneId === zone.id);
    // A pod-label hit keeps the whole pod (still status-filtered); otherwise only the
    // coworkers whose name matches.
    const labelHit = needle.length > 0 && zone.label.toLowerCase().includes(needle);
    const visible = occupants.filter((user) =>
      labelHit ? status === null || user.status === status : matches(user)
    );
    if (visible.length > 0) {
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
  const wandering = loose.filter(matches);
  if (wandering.length > 0) {
    groups.push({
      count: loose.length,
      id: WANDERING_ID,
      label: 'Walking around',
      occupants: wandering,
      swatch: 'rgb(255 255 255 / 0.35)',
    });
  }
  return groups;
}

function memberMeta(user: PresenceUser, sessions: PresenceV2Session[], now: number): string {
  const session = sessions.find((candidate) =>
    candidate.participants.some((participant) => participant.user_id === user.id)
  );
  if (!session) return PRESENCE_STATUS[user.status].description;
  const partners = session.participants
    .filter((participant) => participant.user_id !== user.id)
    .map((participant) => participant.username);
  const duration = formatPresenceDuration(Math.max(0, now - session.started_at));
  return partners.length > 0
    ? `Co-working with ${partners.join(', ')} · ${duration}`
    : `At a table · ${duration}`;
}

export function PixelOfficeDirectory({
  onChat,
  onReact,
  reducedMotion,
  serverTime,
  sessions = [],
  users,
  zones,
}: PixelOfficeDirectoryProps) {
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<null | PresenceState>(null);
  const needle = query.trim().toLowerCase();
  const groups = buildGroups(zones, users, needle, status);
  const counts = countStates(users.map((user) => user.status));
  const now = serverTime ?? Math.floor(Date.now() / 1000);
  const filtered = needle.length > 0 || status !== null;

  return (
    <section aria-labelledby="roster-heading" className={`${styles.panel} flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={styles.eyebrow}>Live roster</p>
          <h2 className={styles.title} id="roster-heading">
            {users.length} in this room
          </h2>
        </div>
        {onChat ? (
          <button className={styles.btn} onClick={onChat} type="button">
            <MessageSquareIcon aria-hidden className="size-4" /> Chat
          </button>
        ) : null}
      </div>

      <label className={styles.search}>
        <span className="sr-only">Search people or pods</span>
        <SearchIcon aria-hidden />
        <input
          className={styles.input}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people or pods"
          type="search"
          value={query}
        />
      </label>

      <div aria-label="Filter by status" className={styles.chips} role="group">
        <button
          aria-pressed={status === null}
          className={styles.chip}
          onClick={() => setStatus(null)}
          type="button"
        >
          All <span className={styles.chipCount}>{users.length}</span>
        </button>
        {PRESENCE_STATES.map((state) => (
          <button
            aria-pressed={status === state}
            className={`${styles.chip} ${styles[state]}`}
            key={state}
            onClick={() => setStatus(status === state ? null : state)}
            title={PRESENCE_STATUS[state].description}
            type="button"
          >
            <span aria-hidden className={styles.dot} />
            {PRESENCE_STATUS[state].label}
            <span className={styles.chipCount}>{counts[state]}</span>
          </button>
        ))}
      </div>

      {/* Not a live region: session timers tick every minute and would be re-announced.
          The activity feed is the page's live region. */}
      <div className="flex flex-col gap-4">
        {groups.length === 0 ? (
          <div className={styles.empty}>
            <span>{filtered ? 'Nobody matches these filters.' : 'Nobody is here yet.'}</span>
            {filtered ? (
              <button
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => {
                  setQuery('');
                  setStatus(null);
                }}
                type="button"
              >
                <XIcon aria-hidden className="size-4" /> Clear filters
              </button>
            ) : null}
          </div>
        ) : null}
        {groups.map((group) => (
          <div className={styles.group} key={group.id}>
            <div className={styles.groupHead}>
              <span className="flex min-w-0 items-center truncate">
                <span
                  aria-hidden
                  className={styles.swatch}
                  style={{ '--swatch': group.swatch } as React.CSSProperties}
                />
                {group.label}
              </span>
              <span>{group.count} here</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              <AnimatePresence initial={false}>
                {group.occupants.map((user) => {
                  const appearance = user.appearance ?? appearanceFor(user.id);
                  const meta = PRESENCE_STATUS[user.status];
                  return (
                    <motion.li
                      animate={{ opacity: 1, y: 0 }}
                      className={`${styles.member} ${user.isCurrentUser ? styles.memberMe : ''}`}
                      exit={{ opacity: 0, y: -4 }}
                      initial={{ opacity: 0, y: 6 }}
                      key={user.id}
                      layout={!reducedMotion}
                    >
                      <span className={`${styles.avatar} ${styles.pixel}`}>
                        <PresenceSprite
                          {...appearance}
                          color={appearance.shirtColor}
                          reducedMotion
                          size={34}
                          status={user.status}
                        />
                        <span
                          aria-hidden
                          className={`${styles.dot} ${styles[user.status]} ${
                            user.status === 'coding' && !reducedMotion ? styles.dotPulse : ''
                          }`}
                        />
                      </span>
                      <span className={styles.memberBody}>
                        <span className={styles.memberName}>
                          {user.username}
                          {user.isCurrentUser ? <span className={styles.faint}> · you</span> : null}
                        </span>
                        {user.statusMessage ? (
                          <span
                            className={`${styles.memberStatus} block`}
                            title={user.statusMessage.text}
                          >
                            {user.statusMessage.emoji ? (
                              <span aria-hidden>{user.statusMessage.emoji} </span>
                            ) : null}
                            {user.statusMessage.text}
                          </span>
                        ) : null}
                        <span className={`${styles.memberMeta} block`}>
                          {memberMeta(user, sessions, now)}
                        </span>
                      </span>
                      <span className={`${styles.status} ${styles[user.status]}`}>
                        <span aria-hidden>{meta.glyph}</span>
                        {meta.label}
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>
        ))}
      </div>

      {onReact ? (
        <div className="flex flex-col gap-2">
          <p className={styles.eyebrow}>Send a reaction</p>
          <div aria-label="Office reactions" className={styles.reactions} role="group">
            {REACTIONS.map((reaction) => (
              <button
                aria-label={reaction.label}
                className={styles.reaction}
                key={reaction.emoji}
                onClick={() => onReact(reaction.emoji)}
                title={reaction.label}
                type="button"
              >
                <span aria-hidden>{reaction.emoji}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
