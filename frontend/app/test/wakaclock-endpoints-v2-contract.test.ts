import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import * as api from '@/lib/wakaclock/endpoints-v2';

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_WAKACLOCK_API_URL: 'http://contracts.test' } }));
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const goal = {
  name: 'Daily',
  direction: 'at_least',
  filter_kind: 'all',
  filter_value: null,
  metric: 'duration',
  period: 'daily',
  starts_on: '2026-10-01',
  target_seconds: 60,
};
const board = { metric: 'duration', period: 'weekly', visibility: 'private' };
const sharing = { share_aggregate: true, share_individual: false };
const range = { start: '2026-10-01', end: '2026-10-02', timezone: 'Asia/Bangkok' };
type Contract = [string, () => Promise<unknown>, string, string, unknown?];
const contracts: Contract[] = [
  ['capabilities', () => api.getCapabilities(), 'GET', '/capabilities'],
  ['delivery', () => api.getDeliveryStatus(), 'GET', '/me/delivery-status'],
  [
    'repair preview',
    () => api.startMeasurementRepair({ ...range, repairId: 'repair', candidates: [] }),
    'POST',
    '/me/measurement-repairs',
    { ...range, repair_id: 'repair', candidates: [] },
  ],
  ['repairs', () => api.listMeasurementRepairs(), 'GET', '/me/measurement-repairs'],
  [
    'apply repair',
    () => api.applyMeasurementRepair('repair'),
    'POST',
    '/me/measurement-repairs/repair/apply',
  ],
  [
    'rollback repair',
    () => api.rollbackMeasurementRepair('repair'),
    'POST',
    '/me/measurement-repairs/repair/rollback',
  ],
  ['organizations', () => api.listOrganizations(), 'GET', '/organizations'],
  [
    'create organization',
    () => api.createOrganization('Studio'),
    'POST',
    '/organizations',
    { name: 'Studio' },
  ],
  ['sharing', () => api.getOrganizationSharing('org'), 'GET', '/organizations/org/me/sharing'],
  [
    'update sharing',
    () => api.updateOrganizationSharing('org', sharing),
    'PUT',
    '/organizations/org/me/sharing',
    sharing,
  ],
  ['teams', () => api.listOrganizationTeams('org'), 'GET', '/organizations/org/teams'],
  [
    'create team',
    () => api.createOrganizationTeam('org', 'Team'),
    'POST',
    '/organizations/org/teams',
    { name: 'Team' },
  ],
  ['members', () => api.listOrganizationMembers('org'), 'GET', '/organizations/org/members'],
  [
    'invite',
    () => api.inviteOrganizationMember('org', 'user', 'member', 'developer'),
    'POST',
    '/organizations/org/invites',
    { username: 'user', role: 'member', seat_type: 'developer' },
  ],
  ['invites', () => api.listOrganizationInvites('org'), 'GET', '/organizations/org/invites'],
  [
    'revoke invite',
    () => api.revokeOrganizationInvite('org', 'invite'),
    'DELETE',
    '/organizations/org/invites/invite',
  ],
  ['my invites', () => api.listMyOrganizationInvites(), 'GET', '/me/organization-invites'],
  [
    'accept invite',
    () => api.acceptOrganizationInvite('invite'),
    'POST',
    '/me/organization-invites/invite/accept',
  ],
  [
    'decline invite',
    () => api.declineOrganizationInvite('invite'),
    'POST',
    '/me/organization-invites/invite/decline',
  ],
  [
    'team members',
    () => api.listTeamMembers('org', 'team'),
    'GET',
    '/organizations/org/teams/team/members',
  ],
  [
    'add team member',
    () => api.addTeamMember('org', 'team', 'user', 'member'),
    'POST',
    '/organizations/org/teams/team/members',
    { user_id: 'user', role: 'member' },
  ],
  [
    'remove team member',
    () => api.removeTeamMember('org', 'team', 'user'),
    'DELETE',
    '/organizations/org/teams/team/members/user',
  ],
  [
    'start import',
    () => api.startWakaTimeImport('import', 2),
    'POST',
    '/imports/wakatime',
    { import_id: 'import', total_chunks: 2 },
  ],
  ['import status', () => api.getWakaTimeImport('import'), 'GET', '/imports/wakatime/import'],
  [
    'preview chunk',
    () => api.previewWakaTimeImportChunk('import', 1, '{}'),
    'POST',
    '/imports/wakatime/import/chunks/1/preview',
    { dump_json: '{}' },
  ],
  [
    'upload chunk',
    () => api.uploadWakaTimeImportChunk('import', 1, '{}'),
    'PUT',
    '/imports/wakatime/import/chunks/1',
    { dump_json: '{}', confirm_legacy_ambiguity: false },
  ],
  [
    'confirmed import',
    () => api.uploadWakaTimeImportChunk('import', 1, '{}', true),
    'PUT',
    '/imports/wakatime/import/chunks/1',
    { dump_json: '{}', confirm_legacy_ambiguity: true },
  ],
  [
    'complete import',
    () => api.completeWakaTimeImport('import'),
    'POST',
    '/imports/wakatime/import/complete',
  ],
  ['goals', () => api.listGoals(), 'GET', '/me/goals'],
  ['create goal', () => api.createGoal(goal), 'POST', '/me/goals', goal],
  ['update goal', () => api.updateGoal('goal', goal), 'PATCH', '/me/goals/goal', goal],
  ['delete goal', () => api.deleteGoal('goal'), 'DELETE', '/me/goals/goal'],
  ['goal progress', () => api.getGoalProgress('goal'), 'GET', '/me/goals/goal/progress'],
  ['leaderboards', () => api.listLeaderboards(), 'GET', '/leaderboards'],
  ['create leaderboard', () => api.createLeaderboard(board), 'POST', '/leaderboards', board],
  [
    'leaderboard members',
    () => api.listLeaderboardMembers('board'),
    'GET',
    '/leaderboards/board/members',
  ],
  [
    'add leaderboard member',
    () => api.addLeaderboardMember('board', 'user'),
    'POST',
    '/leaderboards/board/members',
    { user_id: 'user' },
  ],
  [
    'remove leaderboard member',
    () => api.removeLeaderboardMember('board', 'user'),
    'DELETE',
    '/leaderboards/board/members/user',
  ],
  ['rooms', () => api.listPresenceRooms(), 'GET', '/me/presence/rooms'],
  [
    'create room default ttl',
    () => api.createPresenceRoomV2('Room'),
    'POST',
    '/presence/rooms',
    { name: 'Room', expires_in_seconds: 86400 },
  ],
  [
    'create room custom ttl',
    () => api.createPresenceRoomV2('Room', 60),
    'POST',
    '/presence/rooms',
    { name: 'Room', expires_in_seconds: 60 },
  ],
  ['room', () => api.getPresenceRoomV2('room'), 'GET', '/presence/rooms/room'],
  [
    'resolve invite',
    () => api.resolvePresenceInviteV2('invite'),
    'POST',
    '/presence/invites/resolve',
    { token: 'invite' },
  ],
  ['join defaults', () => api.joinPresenceRoomV2('room'), 'POST', '/presence/rooms/room/join', {}],
  [
    'join invited client',
    () => api.joinPresenceRoomV2('room', 'invite', 'client'),
    'POST',
    '/presence/rooms/room/join',
    { invite_token: 'invite', client_id: 'client' },
  ],
  ['leave room', () => api.leavePresenceRoomV2('room'), 'POST', '/presence/rooms/room/leave'],
  ['end room', () => api.endPresenceRoomV2('room'), 'POST', '/presence/rooms/room/end'],
  [
    'update member',
    () =>
      api.updatePresenceMemberV2('room', {
        client_seq: 1,
        position: { x: 0, y: 1 },
        zone_id: null,
      }),
    'PUT',
    '/presence/rooms/room/me',
    { client_seq: 1, position: { x: 0, y: 1 }, zone_id: null },
  ],
  [
    'stream ticket',
    () => api.createPresenceStreamTicketV2('room'),
    'POST',
    '/presence/rooms/room/stream-ticket',
  ],
  [
    'invite default ttl',
    () => api.createPresenceInviteV2('room'),
    'POST',
    '/presence/rooms/room/invites',
    { expires_in_seconds: 86400 },
  ],
  [
    'invite custom ttl',
    () => api.createPresenceInviteV2('room', 60),
    'POST',
    '/presence/rooms/room/invites',
    { expires_in_seconds: 60 },
  ],
  ['room invites', () => api.listPresenceInvitesV2('room'), 'GET', '/presence/rooms/room/invites'],
  [
    'revoke room invite',
    () => api.revokePresenceInviteV2('room', 'invite'),
    'DELETE',
    '/presence/rooms/room/invites/invite',
  ],
  ['my status', () => api.getMyPresenceStatusV2(), 'GET', '/me/presence/status'],
  [
    'set status',
    () => api.setMyPresenceStatusV2('Working', null, 60),
    'PUT',
    '/me/presence/status',
    { text: 'Working', emoji: null, expires_in_seconds: 60 },
  ],
  ['clear status', () => api.clearMyPresenceStatusV2(), 'DELETE', '/me/presence/status'],
  ['my focus', () => api.getMyPresenceFocusV2(), 'GET', '/me/presence/focus'],
  [
    'start focus',
    () => api.startMyPresenceFocusV2(60),
    'PUT',
    '/me/presence/focus',
    { duration_seconds: 60 },
  ],
  ['end focus', () => api.endMyPresenceFocusV2(), 'DELETE', '/me/presence/focus'],
];

it.each(contracts)(
  '%s uses the API method, resource and payload contract',
  async (_name, call, method, route, body) => {
    const requests: { method: string; path: string; body: unknown }[] = [];
    server.use(
      http.all('http://contracts.test/api/v2/*', async ({ request }) => {
        const text = await request.text();
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body: text ? JSON.parse(text) : undefined,
        });
        return HttpResponse.json({
          data: { contract_result: true },
          meta: { private_metadata: true },
        });
      })
    );
    const response = await call();
    expect(requests).toEqual([{ method, path: '/api/v2' + route, body }]);
    if (response !== undefined) expect(response).toEqual({ contract_result: true });
  }
);

it('serializes analytics ranges and optional filters without leaking undefined values', async () => {
  const urls: URL[] = [];
  server.use(
    http.get('http://contracts.test/api/v2/*', ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json({ data: null });
    })
  );
  const args = [range.start, range.end, range.timezone] as const;
  await api.getMeasurementQuality(...args);
  await api.getMeasurementQuality(...args, 'a/b');
  await api.getOperationEvidence(...args);
  await api.getOperationEvidence(...args, { projectId: 'a/b', cursor: 'signed+/=', limit: 50 });
  await api.getOrganizationAnalytics('org', ...args);
  await api.listCoworkingHistoryV2();
  await api.listCoworkingHistoryV2({});
  await api.listCoworkingHistoryV2({
    from: range.start,
    to: range.end,
    timezone: range.timezone,
    cursor: 'signed+/=',
    limit: 50,
  });
  await api.getPresenceSummaryV2('org');
  await api.getPresenceSummaryV2('org', {});
  await api.getPresenceSummaryV2('org', {
    from: range.start,
    to: range.end,
    timezone: range.timezone,
    teamId: 'team',
  });
  await api.getOrganizationPresenceHeatmapV2('org', {
    from: range.start,
    to: range.end,
    timezone: range.timezone,
  });
  expect(urls.map((url) => Object.fromEntries(url.searchParams))).toEqual([
    range,
    { ...range, project_id: 'a/b' },
    range,
    { ...range, project_id: 'a/b', cursor: 'signed+/=', limit: '50' },
    range,
    {},
    {},
    {
      from: range.start,
      to: range.end,
      timezone: range.timezone,
      cursor: 'signed+/=',
      limit: '50',
    },
    {},
    {},
    { from: range.start, to: range.end, timezone: range.timezone, team_id: 'team' },
    { from: range.start, to: range.end, timezone: range.timezone },
  ]);
  expect(urls.map((url) => url.pathname)).toEqual([
    '/api/v2/me/measurement-quality',
    '/api/v2/me/measurement-quality',
    '/api/v2/me/ai/operation-evidence',
    '/api/v2/me/ai/operation-evidence',
    '/api/v2/organizations/org/analytics',
    '/api/v2/me/coworking-sessions',
    '/api/v2/me/coworking-sessions',
    '/api/v2/me/coworking-sessions',
    '/api/v2/organizations/org/presence/summary',
    '/api/v2/organizations/org/presence/summary',
    '/api/v2/organizations/org/presence/summary',
    '/api/v2/organizations/org/presence/heatmap',
  ]);
  expect(new URL(api.presenceStreamUrlV2('room', 'ticket+/=')).searchParams.get('ticket')).toBe(
    'ticket+/='
  );
});

it('does not unwrap an unsuccessful response into empty data', async () => {
  server.use(
    http.get('http://contracts.test/api/v2/capabilities', () =>
      HttpResponse.json({ error: 'unavailable' }, { status: 503 })
    )
  );
  await expect(api.getCapabilities()).rejects.toMatchObject({
    status: 503,
    message: 'unavailable',
  });
});
