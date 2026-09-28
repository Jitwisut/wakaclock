'use client';

import * as React from 'react';

import { EyeIcon, XIcon } from 'lucide-react';
import { motion } from 'motion/react';

import type { PresenceStatusMessage } from '@/lib/wakaclock/types';

import styles from './presence-chrome.module.css';

/** Mirrors `STATUS_TEXT_MAX_CHARS` in `backend/api/src/infrastructure/redis_presence.rs`. */
export const STATUS_MAX_CHARS = 80;

const EMOJIS = ['🎯', '🐛', '👀', '🤝', '📚', '🧪', '🚀', '☕'];

const PRESETS = [
  { emoji: '🎯', text: 'Deep work — ping me later' },
  { emoji: '🐛', text: 'Fixing bugs' },
  { emoji: '👀', text: 'Reviewing pull requests' },
  { emoji: '🤝', text: 'Open to pairing' },
  { emoji: '📚', text: 'Learning something new' },
  { emoji: '☕', text: 'On a break' },
];

/** Seconds until the next local midnight, never below the server's 5-minute minimum. */
export function secondsUntilEndOfDay(now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(300, Math.round((midnight.getTime() - now.getTime()) / 1000));
}

const DURATIONS = [
  { label: '30 minutes', value: '1800' },
  { label: '1 hour', value: '3600' },
  { label: '4 hours', value: '14400' },
  { label: 'End of today', value: 'today' },
  { label: '1 week', value: '604800' },
];

export function statusExpiryLabel(expiresAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((expiresAt * 1000 - now) / 60_000));
  if (minutes < 60) return `clears in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `clears in ${hours}h`;
  return `clears in ${Math.round(hours / 24)}d`;
}

interface StatusComposerProps {
  error: null | string;
  onClear: () => Promise<boolean>;
  onClose: () => void;
  onSave: (text: string, emoji: null | string, expiresInSeconds: number) => Promise<boolean>;
  saving: boolean;
  status: null | PresenceStatusMessage;
}

/**
 * Lets you say what you are working on, in your own words. The status is shown only to
 * people in rooms you are in, and always clears itself — nothing about your projects or
 * activity is shared unless you type it here.
 */
export function StatusComposer({
  error,
  onClear,
  onClose,
  onSave,
  saving,
  status,
}: StatusComposerProps) {
  const [text, setText] = React.useState(status?.text ?? '');
  const [emoji, setEmoji] = React.useState<null | string>(status ? status.emoji : '🎯');
  const [duration, setDuration] = React.useState('14400');
  const trimmed = text.trim();
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Focus the text field when the editor opens, without the autoFocus attribute.
  React.useEffect(() => inputRef.current?.focus(), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed || saving) return;
    const seconds =
      duration === 'today' ? secondsUntilEndOfDay(new Date()) : Number.parseInt(duration, 10);
    if (await onSave(trimmed, emoji, seconds)) onClose();
  };

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="status-heading"
      className={`${styles.panel} flex flex-col gap-4`}
      initial={{ opacity: 0, y: -6 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={styles.eyebrow}>
            Your status{status ? ` · ${statusExpiryLabel(status.expires_at)}` : ''}
          </p>
          <h2 className={styles.title} id="status-heading">
            What are you working on?
          </h2>
        </div>
        <button
          aria-label="Close status editor"
          className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`}
          onClick={onClose}
          type="button"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      </div>

      <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
        <div aria-label="Status emoji" className={styles.chips} role="group">
          {EMOJIS.map((candidate) => (
            <button
              aria-label={`Use ${candidate}`}
              aria-pressed={emoji === candidate}
              className={styles.chip}
              key={candidate}
              onClick={() => setEmoji(emoji === candidate ? null : candidate)}
              type="button"
            >
              <span aria-hidden>{candidate}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label>
            <span className="sr-only">Status text</span>
            <input
              aria-describedby="status-count"
              className={styles.input}
              maxLength={STATUS_MAX_CHARS}
              onChange={(event) => setText(event.target.value)}
              placeholder="e.g. Fixing the auth bug in wakaclock-api"
              ref={inputRef}
              value={text}
            />
          </label>
          <span className={`${styles.faint} self-end text-xs`} id="status-count">
            {text.length}/{STATUS_MAX_CHARS}
          </span>
        </div>

        <div aria-label="Suggestions" className={styles.chips} role="group">
          {PRESETS.map((preset) => (
            <button
              className={styles.chip}
              key={preset.text}
              onClick={() => {
                setText(preset.text);
                setEmoji(preset.emoji);
              }}
              type="button"
            >
              <span aria-hidden>{preset.emoji}</span>
              {preset.text}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className={`${styles.muted} whitespace-nowrap`}>Clear after</span>
            <select
              className={`${styles.input} w-auto`}
              onChange={(event) => setDuration(event.target.value)}
              value={duration}
            >
              {DURATIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span className="flex-1" />
          {status ? (
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              disabled={saving}
              onClick={() =>
                void onClear().then((cleared) => {
                  if (cleared) onClose();
                  return cleared;
                })
              }
              type="button"
            >
              Clear status
            </button>
          ) : null}
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!trimmed || saving}
            type="submit"
          >
            {saving ? 'Saving…' : 'Share status'}
          </button>
        </div>
      </form>

      {error ? (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
      <p className={`${styles.faint} flex items-center gap-1.5 text-xs`}>
        <EyeIcon aria-hidden className="size-3.5" />
        Only people in a room with you see it, and it clears itself. Nothing about your projects is
        shared unless you type it.
      </p>
    </motion.section>
  );
}
