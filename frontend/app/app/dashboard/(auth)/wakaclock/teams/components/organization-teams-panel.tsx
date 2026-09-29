'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserMinusIcon, UserPlusIcon, UsersIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryState } from '@/components/wakaclock/query-state';
import { WakaclockError } from '@/lib/wakaclock/client';
import {
  addTeamMember,
  createOrganizationTeam,
  listOrganizationMembers,
  listOrganizationTeams,
  listTeamMembers,
  removeTeamMember,
} from '@/lib/wakaclock/endpoints-v2';
import type {
  OrganizationMember,
  OrganizationTeam,
  TeamRole,
} from '@/lib/wakaclock/measurement-types';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

const TEAM_ROLES = Object.keys(TEAM_ROLE_LABELS) as TeamRole[];

const selectClass =
  'border-input bg-background h-9 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** The backend's own message when there is one, so a 400/403 explains itself. */
function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function TeamMembers({
  organizationId,
  organizationMembers,
  team,
}: {
  organizationId: string;
  /** Present only for owners/admins — which is also what lets them manage the team. */
  organizationMembers?: OrganizationMember[];
  team: OrganizationTeam;
}) {
  const canManage = organizationMembers !== undefined;
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const client = useQueryClient();
  const membersKey = wakaclockKeys.teamMembers(userId, organizationId, team.id);
  const [candidate, setCandidate] = React.useState('');
  const [role, setRole] = React.useState<TeamRole>('member');

  const members = useQuery({
    enabled: Boolean(userId),
    queryFn: () => listTeamMembers(organizationId, team.id),
    queryKey: membersKey,
  });
  const refresh = () => client.invalidateQueries({ queryKey: membersKey });
  const add = useMutation({
    mutationFn: (input: { role: TeamRole; userId: string }) =>
      addTeamMember(organizationId, team.id, input.userId, input.role),
    onSuccess: async () => {
      setCandidate('');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (memberUserId: string) => removeTeamMember(organizationId, team.id, memberUserId),
    onSuccess: refresh,
  });

  const onTeam = new Set((members.data ?? []).map((member) => member.user_id));
  const candidates = (organizationMembers ?? []).filter(
    (member) => member.deactivated_at === null && !onTeam.has(member.user_id)
  );
  const failure = add.error ?? remove.error;

  return (
    <div className="space-y-3">
      <QueryState
        emptyDescription="Nobody is on this team yet."
        emptyTitle="No members"
        error={members.error}
        isEmpty={members.data?.length === 0}
        isLoading={members.isLoading}
        skeletonClassName="h-24 w-full"
      >
        <ul aria-label={`${team.name} members`} className="divide-y rounded-md border">
          {members.data?.map((member) => (
            <li className="flex flex-wrap items-center gap-2 px-3 py-2" key={member.user_id}>
              <span className="min-w-0 flex-1 truncate font-medium">{member.username}</span>
              {canManage ? (
                <>
                  <select
                    aria-label={`Role for ${member.username}`}
                    className={selectClass}
                    disabled={add.isPending}
                    onChange={(event) =>
                      add.mutate({ role: event.target.value as TeamRole, userId: member.user_id })
                    }
                    value={member.role}
                  >
                    {TEAM_ROLES.map((option) => (
                      <option key={option} value={option}>
                        {TEAM_ROLE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                  <Button
                    aria-label={`Remove ${member.username} from ${team.name}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(member.user_id)}
                    size="sm"
                    variant="outline"
                  >
                    <UserMinusIcon aria-hidden className="size-4" />
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {TEAM_ROLE_LABELS[member.role]}
                </span>
              )}
            </li>
          ))}
        </ul>
      </QueryState>

      {canManage ? (
        <form
          aria-label={`Add someone to ${team.name}`}
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (candidate) add.mutate({ role, userId: candidate });
          }}
        >
          <select
            aria-label="Person to add"
            className={`${selectClass} min-w-40 flex-1`}
            onChange={(event) => setCandidate(event.target.value)}
            value={candidate}
          >
            <option value="">
              {candidates.length === 0
                ? 'Everyone in the organization is on this team'
                : 'Choose a person…'}
            </option>
            {candidates.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.username}
              </option>
            ))}
          </select>
          <select
            aria-label="Role for the new member"
            className={selectClass}
            onChange={(event) => setRole(event.target.value as TeamRole)}
            value={role}
          >
            {TEAM_ROLES.map((option) => (
              <option key={option} value={option}>
                {TEAM_ROLE_LABELS[option]}
              </option>
            ))}
          </select>
          <Button disabled={!candidate || add.isPending} size="sm" type="submit">
            <UserPlusIcon aria-hidden className="size-4" /> Add to team
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground text-xs">
          Only organization owners and admins can change who is on a team.
        </p>
      )}
      {failure ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage(failure, 'Could not update the team.')}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Teams inside one organization and who is on them. Anyone in the organization can see
 * the teams and their members; owners and admins can create teams and add, re-role or
 * remove people. Team membership is what opens a team's Presence room and counts it in
 * team co-working reports, so this is where that access is managed.
 */
export function OrganizationTeamsPanel({ organizationId }: { organizationId: string }) {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const client = useQueryClient();
  const teamsKey = wakaclockKeys.organizationTeams(userId, organizationId);
  const [selected, setSelected] = React.useState<null | string>(null);
  const [name, setName] = React.useState('');

  const teams = useQuery({
    enabled: Boolean(userId),
    queryFn: () => listOrganizationTeams(organizationId),
    queryKey: teamsKey,
  });
  // The member list is admin-only on the server, so a successful read is also what
  // tells the panel the viewer may manage teams.
  const organizationMembers = useQuery({
    enabled: Boolean(userId),
    queryFn: () => listOrganizationMembers(organizationId),
    queryKey: wakaclockKeys.organizationMembers(userId, organizationId),
    retry: (count, error) =>
      !(error instanceof WakaclockError && error.status === 403) && count < 2,
  });
  const canManage = organizationMembers.isSuccess;

  const create = useMutation({
    mutationFn: () => createOrganizationTeam(organizationId, name.trim()),
    onSuccess: async (team) => {
      setName('');
      setSelected(team.id);
      await client.invalidateQueries({ queryKey: teamsKey });
    },
  });

  const list = teams.data ?? [];
  const team = list.find((candidate) => candidate.id === selected) ?? list[0];

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="flex items-center gap-2 font-medium">
        <UsersIcon aria-hidden className="size-4" /> Teams &amp; members
      </p>
      <QueryState
        emptyDescription={
          canManage ? 'Create the first team below.' : 'An organization admin can create teams.'
        }
        emptyTitle="No teams yet"
        error={teams.error}
        isEmpty={list.length === 0}
        isLoading={teams.isLoading}
        skeletonClassName="h-24 w-full"
      >
        <div aria-label="Teams" className="flex flex-wrap gap-2" role="group">
          {list.map((candidate) => (
            <Button
              aria-pressed={candidate.id === team?.id}
              key={candidate.id}
              onClick={() => setSelected(candidate.id)}
              size="sm"
              variant={candidate.id === team?.id ? 'default' : 'outline'}
            >
              {candidate.name}
            </Button>
          ))}
        </div>
        {team ? (
          <TeamMembers
            key={team.id}
            organizationId={organizationId}
            organizationMembers={organizationMembers.data}
            team={team}
          />
        ) : null}
      </QueryState>

      {canManage ? (
        <form
          aria-label="Create a team"
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input
            aria-label="Team name"
            className="max-w-xs"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Platform squad"
            value={name}
          />
          <Button disabled={!name.trim() || create.isPending} size="sm" type="submit">
            Create team
          </Button>
          {create.isError ? (
            <p className="text-destructive w-full text-sm" role="alert">
              {errorMessage(create.error, 'Could not create the team.')}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
