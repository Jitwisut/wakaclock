'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, MailPlusIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WakaclockError } from '@/lib/wakaclock/client';
import {
  acceptOrganizationInvite,
  declineOrganizationInvite,
  inviteOrganizationMember,
  listMyOrganizationInvites,
  listOrganizationInvites,
  revokeOrganizationInvite,
} from '@/lib/wakaclock/endpoints-v2';
import type {
  OrganizationInviteRole,
  OrganizationSeatType,
} from '@/lib/wakaclock/measurement-types';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const ROLE_LABELS: Record<OrganizationInviteRole, string> = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

const SEAT_LABELS: Record<OrganizationSeatType, string> = {
  developer: 'Developer seat',
  viewer: 'Viewer seat',
};

const selectClass =
  'border-input bg-background h-9 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** The page's own organizations list — refreshed after accepting an invite. */
export const ORGANIZATIONS_QUERY_KEY = ['organizations'] as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Admins invite people into the organization by username. The invitee joins only when
 * they accept, so this panel shows who is still pending and lets an admin withdraw an
 * invite. Non-admins never see it (the server answers 403 and the panel stays hidden).
 */
export function OrganizationInvitesPanel({ organizationId }: { organizationId: string }) {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const client = useQueryClient();
  const invitesKey = wakaclockKeys.organizationInvites(userId, organizationId);
  const [username, setUsername] = React.useState('');
  const [role, setRole] = React.useState<OrganizationInviteRole>('member');
  const [seatType, setSeatType] = React.useState<OrganizationSeatType>('developer');
  const [sentTo, setSentTo] = React.useState<null | string>(null);

  const invites = useQuery({
    enabled: Boolean(userId),
    queryFn: () => listOrganizationInvites(organizationId),
    queryKey: invitesKey,
    retry: (count, error) =>
      !(error instanceof WakaclockError && error.status === 403) && count < 2,
  });
  const refresh = () => client.invalidateQueries({ queryKey: invitesKey });
  const invite = useMutation({
    mutationFn: () => inviteOrganizationMember(organizationId, username.trim(), role, seatType),
    onSuccess: async (created) => {
      setSentTo(created.username);
      setUsername('');
      await refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (inviteId: string) => revokeOrganizationInvite(organizationId, inviteId),
    onSuccess: refresh,
  });

  if (!invites.isSuccess) return null;
  const failure = invite.error ?? revoke.error;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="flex items-center gap-2 font-medium">
        <MailPlusIcon aria-hidden className="size-4" /> Invite people
      </p>
      <form
        aria-label="Invite by username"
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSentTo(null);
          if (username.trim()) invite.mutate();
        }}
      >
        <Input
          aria-label="Username"
          className="max-w-48"
          maxLength={64}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Their username"
          value={username}
        />
        <select
          aria-label="Organization role"
          className={selectClass}
          onChange={(event) => setRole(event.target.value as OrganizationInviteRole)}
          value={role}
        >
          {(Object.keys(ROLE_LABELS) as OrganizationInviteRole[]).map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </select>
        <select
          aria-label="Seat type"
          className={selectClass}
          onChange={(event) => setSeatType(event.target.value as OrganizationSeatType)}
          value={seatType}
        >
          {(Object.keys(SEAT_LABELS) as OrganizationSeatType[]).map((option) => (
            <option key={option} value={option}>
              {SEAT_LABELS[option]}
            </option>
          ))}
        </select>
        <Button disabled={!username.trim() || invite.isPending} size="sm" type="submit">
          Send invite
        </Button>
      </form>
      <p className="text-muted-foreground text-xs">
        They join only after accepting on their Teams page. Invites expire after 14 days.
      </p>
      {sentTo ? (
        <p className="text-sm" role="status">
          Invite sent to <strong>{sentTo}</strong>.
        </p>
      ) : null}
      {failure ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage(failure, 'Could not update invites.')}
        </p>
      ) : null}
      {invites.data.length > 0 ? (
        <ul aria-label="Pending invites" className="divide-y rounded-md border">
          {invites.data.map((pending) => (
            <li className="flex flex-wrap items-center gap-2 px-3 py-2" key={pending.id}>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{pending.username}</span>
                <span className="text-muted-foreground text-xs">
                  {' '}
                  · {ROLE_LABELS[pending.role]} · expires {formatDate(pending.expires_at)}
                </span>
              </span>
              <Button
                aria-label={`Withdraw the invite for ${pending.username}`}
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(pending.id)}
                size="sm"
                variant="outline"
              >
                Withdraw
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Invitations waiting for the signed-in user. Accepting joins the organization, which
 * makes team presence and any consented analytics visible to it — so it is an explicit
 * choice, never automatic. Renders nothing when there is nothing to answer.
 */
export function MyOrganizationInvites() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const client = useQueryClient();
  const key = wakaclockKeys.myOrganizationInvites(userId);
  const invites = useQuery({
    enabled: Boolean(userId),
    queryFn: listMyOrganizationInvites,
    queryKey: key,
  });
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: key }),
      client.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY }),
    ]);
  const accept = useMutation({ mutationFn: acceptOrganizationInvite, onSuccess: refresh });
  const decline = useMutation({ mutationFn: declineOrganizationInvite, onSuccess: refresh });
  const busy = accept.isPending || decline.isPending;
  const failure = accept.error ?? decline.error;

  if (!invites.data?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Joining lets the organization see your team presence and any analytics you choose to share
          with it.
        </p>
        <ul aria-label="Your invitations" className="divide-y rounded-md border">
          {invites.data.map((pending) => (
            <li className="flex flex-wrap items-center gap-2 px-3 py-2" key={pending.id}>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{pending.organization_name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {ROLE_LABELS[pending.role]}
                  {pending.invited_by ? ` · invited by ${pending.invited_by}` : ''}
                </span>
              </span>
              <Button
                aria-label={`Accept the invite to ${pending.organization_name}`}
                disabled={busy}
                onClick={() => accept.mutate(pending.id)}
                size="sm"
              >
                <CheckIcon aria-hidden className="size-4" /> Accept
              </Button>
              <Button
                aria-label={`Decline the invite to ${pending.organization_name}`}
                disabled={busy}
                onClick={() => decline.mutate(pending.id)}
                size="sm"
                variant="outline"
              >
                <XIcon aria-hidden className="size-4" /> Decline
              </Button>
            </li>
          ))}
        </ul>
        {failure ? (
          <p className="text-destructive" role="alert">
            {errorMessage(failure, 'Could not answer the invite.')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
