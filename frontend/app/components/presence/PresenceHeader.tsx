import type * as React from 'react';

import { MessageCircleIcon, RefreshCwIcon } from 'lucide-react';

import { statusExpiryLabel } from '@/components/presence/StatusComposer';
import { PRESENCE_STATUS } from '@/lib/presence/presence-status';
import type { PresenceState, PresenceStatusMessage } from '@/lib/wakaclock/types';

import styles from './presence-chrome.module.css';

export type PresenceConnection = 'connecting' | 'live' | 'stale';

interface PresenceHeaderProps {
  connection?: null | PresenceConnection;
  /** Slot for the focus-mode control, rendered beside your status. */
  focusControl?: React.ReactNode;
  /** Your own status message; shown in the "You" chip, which opens the editor. */
  myStatus?: null | PresenceStatusMessage;
  onEditStatus?: () => void;
  onReconnect?: () => void;
  partyCount?: null | number;
  presenceState?: null | PresenceState;
  reconnectStopped?: boolean;
  roomName?: null | string;
  username?: null | string;
}

const CONNECTION: Record<PresenceConnection, { className: string; label: string; title: string }> =
  {
    connecting: {
      className: styles.idle,
      label: 'Connecting',
      title: 'Opening the live room stream',
    },
    live: {
      className: styles.coding,
      label: 'Live',
      title: 'Receiving room updates every few seconds',
    },
    stale: {
      className: styles.offline,
      label: 'Reconnecting',
      title: 'The live stream dropped; retrying automatically',
    },
  };

function StatusButton({
  myStatus,
  onEdit,
}: {
  myStatus: null | PresenceStatusMessage;
  onEdit: () => void;
}) {
  const icon = myStatus?.emoji ? (
    <span aria-hidden>{myStatus.emoji}</span>
  ) : (
    <MessageCircleIcon aria-hidden className="size-4" />
  );
  return (
    <button
      aria-label={myStatus ? `Edit your status: ${myStatus.text}` : 'Set a status'}
      className={`${styles.btn} ${myStatus ? '' : styles.btnGhost}`}
      onClick={onEdit}
      title={myStatus ? `${myStatus.text} · ${statusExpiryLabel(myStatus.expires_at)}` : undefined}
      type="button"
    >
      {icon}
      <span className="max-w-[14rem] truncate">{myStatus?.text ?? 'Set a status'}</span>
    </button>
  );
}

/**
 * The control-room command bar: what this surface is, which room you are in, whether
 * the live stream is healthy, and your own state. Tool entry points live in the tool
 * bar below it — never here as well.
 */
export function PresenceHeader({
  connection,
  focusControl,
  myStatus = null,
  onEditStatus,
  onReconnect,
  partyCount,
  presenceState,
  reconnectStopped = false,
  roomName,
  username,
}: PresenceHeaderProps) {
  const link = connection ? CONNECTION[connection] : null;
  const me = presenceState ? PRESENCE_STATUS[presenceState] : null;
  const meClass = presenceState ? styles[presenceState] : '';

  return (
    <header className={styles.commandBar}>
      <div className={styles.brand}>
        <span aria-hidden className={styles.brandMark}>
          👾
        </span>
        <div className="min-w-0">
          <h1 className={styles.brandTitle}>
            Presence{roomName ? <span className={styles.faint}> / </span> : null}
            {roomName ? <span className="truncate">{roomName}</span> : null}
          </h1>
          <p className={styles.brandSub}>
            PixelOffice · see who is coding, then co-work in a pod · Prototype
          </p>
        </div>
      </div>

      <div className={styles.barRight}>
        {link ? (
          <span className={`${styles.pill} ${link.className}`} role="status" title={link.title}>
            <span
              aria-hidden
              className={`${styles.dot} ${connection === 'live' ? styles.dotPulse : ''}`}
            />
            {link.label}
          </span>
        ) : null}
        {reconnectStopped && onReconnect ? (
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={onReconnect}
            type="button"
          >
            <RefreshCwIcon aria-hidden className="size-4" /> Reconnect
          </button>
        ) : null}
        {typeof partyCount === 'number' ? (
          <span className={styles.pill}>
            <strong>{partyCount}</strong> in room
          </span>
        ) : null}
        {username ? (
          <span className={styles.pill} title={me?.description}>
            <span className={styles.faint}>You</span>
            <strong className="max-w-[10rem] truncate">{username}</strong>
            {me ? (
              <span className={`${styles.status} ${meClass}`}>
                <span aria-hidden>{me.glyph}</span> {me.label}
              </span>
            ) : null}
          </span>
        ) : null}
        {focusControl}
        {onEditStatus ? <StatusButton myStatus={myStatus} onEdit={onEditStatus} /> : null}
      </div>
    </header>
  );
}
