'use client';
import * as React from 'react';

import { toast } from 'sonner';

import type { OfficeController } from '@/hooks/use-office';
import {
  createPresenceInviteV2,
  listPresenceInvitesV2,
  revokePresenceInviteV2,
} from '@/lib/wakaclock/endpoints-v2';
import type { OfficeCommand } from '@/lib/wakaclock/office';
import type { PresenceV2Invite } from '@/lib/wakaclock/types';
import type { PresenceUser } from '@/types/presence';

import { appearanceFor, type SpriteAppearance } from './appearance';
import { OfficeChat } from './OfficeChat';
import { PresenceSprite } from './PresenceSprite';

export function OfficeTools({
  panel,
  onClose,
  office,
  roomId,
  userId,
  users,
  onSpace,
  onRenamed,
}: {
  office: OfficeController;
  onClose: () => void;
  onRenamed: (name: string) => void;
  onSpace: (id: string) => Promise<void>;
  panel: string;
  roomId: string;
  userId: string;
  users: PresenceUser[];
}) {
  const [name, setName] = React.useState('');
  const [minutes, setMinutes] = React.useState(25);
  const [appearance, setAppearance] = React.useState<SpriteAppearance>(
    () => office.data?.profiles[userId] ?? appearanceFor(userId)
  );
  const [invites, setInvites] = React.useState<PresenceV2Invite[]>([]);
  const [inviteUrl, setInviteUrl] = React.useState('');
  const [inviteError, setInviteError] = React.useState('');
  const { data } = office;
  const run = async (command: OfficeCommand) => {
    try {
      return await office.send(command);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
      return null;
    }
  };
  React.useEffect(() => {
    if (panel === 'Office settings' && data?.can_invite) {
      void listPresenceInvitesV2(roomId)
        .then(setInvites)
        .catch((error) => setInviteError(String(error)));
    }
  }, [panel, roomId, data?.can_invite]);
  const field = 'presence-input w-full border p-2';
  const button = 'presence-button border px-3 py-2 disabled:opacity-50';
  return (
    <section
      aria-label={panel}
      className="my-3 border-2 p-4"
      style={{ background: 'var(--presence-panel)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold">{panel}</h2>
        <button className={button} onClick={onClose} type="button">
          Close
        </button>
      </div>
      {office.error && <p role="alert">{office.error}</p>}
      {!data && <p role="status">Loading office…</p>}
      {panel === 'Chat' && <OfficeChat roomId={roomId} />}
      {panel === 'Party members' && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <li className="border p-3" key={u.id}>
              <strong>{u.username}</strong>
              <p className="text-xs">
                {u.status} · {u.zoneId ? 'In a pod' : 'Walking around'}
              </p>
            </li>
          ))}
        </ul>
      )}
      {(panel === 'Floors' || panel === 'Meeting chambers') && (
        <div className="space-y-3">
          {data?.parent && (
            <button
              className={button}
              onClick={() =>
                void onSpace(data.parent!.id).catch((error) => toast.error(String(error)))
              }
              type="button"
            >
              Return to {data.parent.name}
            </button>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {data?.spaces
              .filter((s) => s.kind === (panel === 'Floors' ? 'floor' : 'meeting'))
              .map((s) => (
                <li className="flex items-center justify-between gap-2 border p-3" key={s.id}>
                  <span>{s.name}</span>
                  <button
                    className={button}
                    onClick={() => void onSpace(s.id).catch((error) => toast.error(String(error)))}
                    type="button"
                  >
                    Enter
                  </button>
                </li>
              ))}
          </ul>
          {data?.can_manage && !data.parent ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run({
                  kind: 'space',
                  name,
                  space_kind: panel === 'Floors' ? 'floor' : 'meeting',
                }).then((r) => {
                  if (r) setName('');
                  return r;
                });
              }}
            >
              <label className="flex-1">
                Space name
                <input
                  className={field}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  required
                  value={name}
                />
              </label>
              <button className={button} disabled={office.pending} type="submit">
                Create {panel === 'Floors' ? 'floor' : 'meeting room'}
              </button>
              <p className="w-full text-xs">
                New spaces expire after 24 hours. Members inherit access from this office.
              </p>
            </form>
          ) : (
            <p className="text-sm">The main office owner manages spaces.</p>
          )}
        </div>
      )}
      {panel === 'Quests & sprints' && (
        <div className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run({ kind: 'sprint', title: name, minutes }).then((r) => {
                if (r) setName('');
                return r;
              });
            }}
          >
            <label className="flex-1">
              Goal
              <input
                className={field}
                maxLength={160}
                onChange={(e) => setName(e.target.value)}
                required
                value={name}
              />
            </label>
            <label>
              Minutes
              <input
                className={field}
                max={180}
                min={1}
                onChange={(e) => setMinutes(Number(e.target.value))}
                required
                type="number"
                value={minutes}
              />
            </label>
            <button className={button} disabled={office.pending} type="submit">
              Start sprint
            </button>
          </form>
          {data?.sprints.map((s) => {
            const ended = s.finished || s.ends_at <= data.server_time;
            const me = s.members.find((m) => m.user_id === userId);
            let joinLabel = 'Join sprint';
            if (me) joinLabel = me.completed ? 'Mark incomplete' : 'Complete goal';
            return (
              <article className="flex flex-wrap items-center gap-3 border p-3" key={s.id}>
                <div className="flex-1">
                  <h3>{s.title}</h3>
                  <p className="text-xs">
                    {ended
                      ? 'Finished'
                      : `${Math.max(1, Math.ceil((s.ends_at - data.server_time) / 60))} min remaining`}{' '}
                    · {s.members.length} joined · {s.members.filter((m) => m.completed).length}{' '}
                    completed
                  </p>
                </div>
                {!ended && (
                  <button
                    className={button}
                    disabled={office.pending}
                    onClick={() =>
                      void run({
                        kind: 'sprint_join',
                        id: s.id,
                        completed: me ? !me.completed : false,
                      })
                    }
                    type="button"
                  >
                    {joinLabel}
                  </button>
                )}
                {!ended && s.created_by === userId && (
                  <button
                    className={button}
                    disabled={office.pending}
                    onClick={() => void run({ kind: 'sprint_finish', id: s.id })}
                    type="button"
                  >
                    End sprint
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {panel === 'Sprite customizer' && (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ kind: 'profile', appearance }).then((r) => {
              if (r) toast.success('Sprite saved');
              return r;
            });
          }}
        >
          <div className="flex items-center justify-center">
            <PresenceSprite
              {...appearance}
              color={appearance.shirtColor}
              reducedMotion
              size={80}
              status="idle"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['skinColor', 'shirtColor', 'hairColor', 'accentColor'] as const).map((k) => (
              <label className="text-sm" key={k}>
                {k}
                <input
                  aria-label={k}
                  onChange={(e) => setAppearance((a) => ({ ...a, [k]: e.target.value }))}
                  type="color"
                  value={appearance[k]}
                />
              </label>
            ))}
            {(
              [
                ['hairStyle', ['bob', 'bun', 'curls', 'spiky', 'swept']],
                ['accessory', ['none', 'beanie', 'cap', 'glasses', 'headset']],
                ['outfit', ['hoodie', 'jacket', 'overalls']],
              ] as const
            ).map(([k, values]) => (
              <label key={k}>
                {k}
                <select
                  className={field}
                  onChange={(e) => setAppearance((a) => ({ ...a, [k]: e.target.value }))}
                  value={appearance[k]}
                >
                  {values.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button className={button} disabled={office.pending} type="submit">
            Save sprite
          </button>
        </form>
      )}
      {panel === 'Office settings' &&
        (data?.can_manage ? (
          <div className="space-y-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run({ kind: 'rename', name }).then((r) => {
                  if (r) {
                    onRenamed(name.trim());
                    setName('');
                  }
                  return r;
                });
              }}
            >
              <label className="flex-1">
                Room name
                <input
                  className={field}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  required
                  value={name}
                />
              </label>
              <button className={button} disabled={office.pending} type="submit">
                Save name
              </button>
            </form>
            <button
              className={button}
              disabled={!data.can_invite}
              onClick={() =>
                void createPresenceInviteV2(roomId)
                  .then(async (invite) => {
                    setInviteUrl(
                      `${window.location.origin}${window.location.pathname}#invite=${invite.invite_url_token}`
                    );
                    setInvites(await listPresenceInvitesV2(roomId));
                    return invite;
                  })
                  .catch((error) => setInviteError(String(error)))
              }
              type="button"
            >
              Create invite link
            </button>
            {inviteUrl && (
              <label className="block">
                New invite link
                <input
                  className={field}
                  onFocus={(e) => e.target.select()}
                  readOnly
                  value={inviteUrl}
                />
              </label>
            )}
            {inviteError && <p role="alert">{inviteError}</p>}
            <ul className="space-y-2">
              {invites.map((i) => (
                <li className="flex flex-wrap items-center gap-2 text-xs" key={i.id}>
                  <span>
                    {i.id.slice(0, 8)} · expires {new Date(i.expires_at).toLocaleString()}
                  </span>
                  <button
                    className={button}
                    onClick={() =>
                      void revokePresenceInviteV2(roomId, i.id)
                        .then(() => {
                          setInvites((old) => old.filter((v) => v.id !== i.id));
                          setInviteUrl('');
                          return null;
                        })
                        .catch((error) => setInviteError(String(error)))
                    }
                    type="button"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>Only the room owner can change settings and manage invites.</p>
        ))}
    </section>
  );
}
