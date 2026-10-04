import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import * as api from '@/lib/wakaclock/endpoints';
import { setCurrentToken } from '@/lib/wakaclock/session';

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_WAKACLOCK_API_URL: 'http://contracts.test' } }));
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  setCurrentToken(null);
  vi.unstubAllGlobals();
});
afterAll(() => server.close());
const range = { start: '2026-10-01', end: '2026-10-02' };
const heartbeat = { entity: 'fixture.rs', entity_type: 'file' as const, time: 1 };
const rule = { pattern: 'fixture/*', priority: 1, project_name: 'Fixture', user_id: 'user' };
const merge = { source_project: 'Old', target_project: 'New', user_id: 'user' };
type Contract = [string, () => Promise<unknown>, string, string, unknown?, Record<string, string>?];
const contracts: Contract[] = [
  [
    'explorer',
    () => api.getAnalyticsExplorer({ ...range, timezone: 'Asia/Bangkok' }),
    'GET',
    '/dashboard/explorer',
    undefined,
    { ...range, timezone: 'Asia/Bangkok' },
  ],
  [
    'register',
    () => api.registerAccount('test', 'fixture-password'),
    'POST',
    '/auth/register',
    { username: 'test', password: 'fixture-password' },
  ],
  [
    'login',
    () => api.loginAccount('test', 'fixture-password'),
    'POST',
    '/auth/login',
    { username: 'test', password: 'fixture-password' },
  ],
  [
    'status',
    () => api.getStatusBar(),
    'GET',
    '/status_bar/today',
    undefined,
    { timezone: 'Asia/Bangkok' },
  ],
  [
    'all time',
    () => api.getAllTime('user'),
    'GET',
    '/all_time_since_today',
    undefined,
    { user_id: 'user', timezone: 'Asia/Bangkok' },
  ],
  [
    'stats',
    () => api.getStats('user', 'last_7_days'),
    'GET',
    '/stats/last_7_days',
    undefined,
    { user_id: 'user', timezone: 'Asia/Bangkok' },
  ],
  [
    'summaries',
    () => api.getSummaries('user', range.start, range.end),
    'GET',
    '/summaries',
    undefined,
    { user_id: 'user', ...range, timezone: 'Asia/Bangkok' },
  ],
  [
    'durations timezone',
    () => api.getDurations('user', range.start, 'Asia/Bangkok'),
    'GET',
    '/durations',
    undefined,
    { user_id: 'user', date: range.start, timezone: 'Asia/Bangkok' },
  ],
  [
    'durations default',
    () => api.getDurations('user', range.start),
    'GET',
    '/durations',
    undefined,
    { user_id: 'user', date: range.start },
  ],
  [
    'projects',
    () => api.getProjects('user', range.start, range.end),
    'GET',
    '/projects',
    undefined,
    { user_id: 'user', ...range, timezone: 'Asia/Bangkok' },
  ],
  [
    'insights',
    () => api.getInsights('user', 'languages', 'last_7_days'),
    'GET',
    '/insights/languages/last_7_days',
    undefined,
    { user_id: 'user', timezone: 'Asia/Bangkok' },
  ],
  [
    'AI stats legacy',
    () => api.getAiStats('user', range.start, range.end),
    'GET',
    '/users/current/ai_stats',
    undefined,
    { user_id: 'user', ...range },
  ],
  [
    'diagnostics',
    () => api.getAiDiagnostics('user'),
    'GET',
    '/users/current/ai_diagnostics',
    undefined,
    { user_id: 'user' },
  ],
  [
    'diagnostics v2',
    () => api.getAiDiagnosticsV2('user'),
    'GET',
    '/users/current/ai_diagnostics/v2',
    undefined,
    { user_id: 'user' },
  ],
  [
    'keystrokes',
    () => api.getKeystrokeStats('user', range.start, range.end),
    'GET',
    '/users/current/keystroke_stats',
    undefined,
    { user_id: 'user', ...range },
  ],
  [
    'current user',
    () => api.getCurrentUser('user'),
    'GET',
    '/users/current',
    undefined,
    { user_id: 'user' },
  ],
  [
    'dashboard',
    () => api.getDashboardAnalytics(range),
    'GET',
    '/dashboard/analytics',
    undefined,
    range,
  ],
  [
    'project cards',
    () => api.getProjectAnalytics({ ...range, cursor: 'signed+/=', limit: 25 }),
    'GET',
    '/projects/analytics',
    undefined,
    { ...range, cursor: 'signed+/=', limit: '25' },
  ],
  [
    'project detail',
    () => api.getProjectAnalyticsDetail('project', range),
    'GET',
    '/projects/project/analytics',
    undefined,
    range,
  ],
  [
    'project files',
    () => api.getProjectAnalyticsFiles('project', { ...range, branch: 'feature/a' }),
    'GET',
    '/projects/project/files',
    undefined,
    { ...range, branch: 'feature/a' },
  ],
  [
    'project branches',
    () => api.getProjectAnalyticsBranches('project', range),
    'GET',
    '/projects/project/branches',
    undefined,
    range,
  ],
  [
    'project daily',
    () => api.getProjectAnalyticsDaily('project', range),
    'GET',
    '/projects/project/daily',
    undefined,
    range,
  ],
  [
    'project AI',
    () => api.getProjectAnalyticsAi('project', range),
    'GET',
    '/projects/project/ai',
    undefined,
    range,
  ],
  ['key metadata', () => api.getCurrentApiKey(), 'GET', '/users/current/api_key'],
  ['generate key', () => api.generateApiKey(), 'POST', '/users/current/api_key'],
  ['revoke key', () => api.revokeApiKey(), 'DELETE', '/users/current/api_key'],
  [
    'heartbeats',
    () => api.getHeartbeats('user', range.start, 'Asia/Bangkok'),
    'GET',
    '/heartbeats',
    undefined,
    { user_id: 'user', date: range.start, timezone: 'Asia/Bangkok' },
  ],
  ['heartbeat', () => api.sendHeartbeat(heartbeat), 'POST', '/heartbeats', heartbeat],
  ['bulk', () => api.sendHeartbeatsBulk([heartbeat]), 'POST', '/heartbeats.bulk', [heartbeat]],
  ['create unassigned room', () => api.createPresenceRoom(), 'POST', '/presence/rooms'],
  [
    'create team room',
    () => api.createPresenceRoom('team'),
    'POST',
    '/presence/rooms',
    { team_id: 'team' },
  ],
  ['join room', () => api.joinPresenceRoom('room'), 'POST', '/presence/rooms/room/join'],
  ['leave room', () => api.leavePresenceRoom('room'), 'POST', '/presence/rooms/room/leave'],
  [
    'move',
    () => api.updatePresencePosition('room', 0, 10),
    'POST',
    '/presence/rooms/room/position',
    { x: 0, y: 10 },
  ],
  [
    'join session',
    () => api.startOrJoinSession('room', 'peer'),
    'POST',
    '/presence/rooms/room/sessions',
    { with_user_id: 'peer' },
  ],
  ['leave session', () => api.leaveSession('room'), 'POST', '/presence/rooms/room/sessions/leave'],
  [
    'rules',
    () => api.getProjectRules('user'),
    'GET',
    '/project_rules',
    undefined,
    { user_id: 'user' },
  ],
  ['save rule', () => api.upsertProjectRule('rule', rule), 'PUT', '/project_rules/rule', rule],
  [
    'delete rule',
    () => api.deleteProjectRule('rule', 'user'),
    'DELETE',
    '/project_rules/rule',
    undefined,
    { user_id: 'user' },
  ],
  [
    'merges',
    () => api.getProjectMerges('user'),
    'GET',
    '/project_merges',
    undefined,
    { user_id: 'user' },
  ],
  [
    'save merge',
    () => api.upsertProjectMerge('merge', merge),
    'PUT',
    '/project_merges/merge',
    merge,
  ],
  [
    'delete merge',
    () => api.deleteProjectMerge('merge', 'user'),
    'DELETE',
    '/project_merges/merge',
    undefined,
    { user_id: 'user' },
  ],
  [
    'reprocess defaults dry run',
    () => api.reprocess(range.start, range.end),
    'POST',
    '/reprocess',
    { ...range, dry_run: true },
  ],
  [
    'reprocess apply',
    () => api.reprocess(range.start, range.end, false),
    'POST',
    '/reprocess',
    { ...range, dry_run: false },
  ],
  [
    'import uses authenticated owner',
    () => api.importWakaTime('ignored-user', '{}'),
    'POST',
    '/import/wakatime',
    { dump_json: '{}' },
  ],
  ['create org', () => api.createOrg('Org'), 'POST', '/orgs', { name: 'Org' }],
  ['orgs', () => api.listOrgs(), 'GET', '/orgs'],
  ['create team', () => api.createTeam('org', 'Team'), 'POST', '/orgs/org/teams', { name: 'Team' }],
  ['teams', () => api.listTeams('org'), 'GET', '/orgs/org/teams'],
  [
    'add member',
    () => api.addTeamMember('org', 'team', 'user'),
    'POST',
    '/orgs/org/teams/team/members',
    { user_id: 'user' },
  ],
];

it.each(contracts)(
  '%s preserves the v1 wire contract',
  async (_name, call, method, path, body, params = {}) => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Asia/Bangkok',
    } as Intl.ResolvedDateTimeFormatOptions);
    const requests: unknown[] = [];
    server.use(
      http.all('http://contracts.test/api/v1/*', async ({ request }) => {
        const url = new URL(request.url);
        const text = await request.text();
        requests.push({
          method: request.method,
          path: url.pathname,
          body: text ? JSON.parse(text) : undefined,
          params: Object.fromEntries(url.searchParams),
        });
        return HttpResponse.json({ data: { contract_result: true }, status: 'ok' });
      })
    );
    expect(await call()).toEqual({ data: { contract_result: true }, status: 'ok' });
    expect(requests).toEqual([{ method, path: '/api/v1' + path, body, params }]);
  }
);

it('omits unknown browser timezones and handles server rendering', () => {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    timeZone: '',
  } as Intl.ResolvedDateTimeFormatOptions);
  expect(api.getBrowserTimezone()).toBeUndefined();
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
    throw new Error('unavailable');
  });
  expect(api.getBrowserTimezone()).toBeUndefined();
  vi.stubGlobal('window', undefined);
  expect(api.getBrowserTimezone()).toBeUndefined();
});

it('opens a legacy stream only for a signed-in account and encodes its token', () => {
  expect(api.presenceStreamUrl('room')).toBeNull();
  setCurrentToken('signed+/=');
  expect(api.presenceStreamUrl('room')).toBe(
    'http://contracts.test/api/v1/presence/rooms/room/stream?token=signed%2B%2F%3D'
  );
});
