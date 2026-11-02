import { beforeEach, expect, it, vi } from 'vitest';

import { wakaclockClient } from '@/lib/wakaclock/client';
import { wakaclockV2Client } from '@/lib/wakaclock/client-v2';
import { getProjectCity, getReplay } from '@/lib/wakaclock/endpoints';
import { getAgentLive, getAgentUniverse } from '@/lib/wakaclock/endpoints-v2';
import { getReplayEvents } from '@/lib/wakaclock/github-endpoints';

vi.mock('@/lib/wakaclock/client', () => ({ wakaclockClient: { get: vi.fn() } }));
vi.mock('@/lib/wakaclock/client-v2', () => ({
  unwrapV2: (response: { data: { data: unknown } }) => response.data.data,
  wakaclockV2Client: { get: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(wakaclockClient.get).mockResolvedValue({ data: { segments: [] } });
  vi.mocked(wakaclockV2Client.get).mockResolvedValue({ data: { data: { events: [] } } });
});

it('requests a replay with the explorer filters and never a user id', async () => {
  const params = { end: '2026-08-02', language: 'Rust', start: '2026-08-01', timezone: 'UTC' };

  expect(await getReplay(params)).toEqual({ segments: [] });
  expect(wakaclockClient.get).toHaveBeenCalledWith('/dashboard/replay', { params });
});

it('requests a project city by id and timezone', async () => {
  expect(await getProjectCity('project-a', 'UTC')).toEqual({ segments: [] });
  expect(wakaclockClient.get).toHaveBeenCalledWith('/dashboard/city', {
    params: { project_id: 'project-a', timezone: 'UTC' },
  });
});

it('requests the agent universe for a range', async () => {
  const params = { end: '2026-08-02', start: '2026-08-01', timezone: 'UTC' };

  expect(await getAgentUniverse(params)).toEqual({ events: [] });
  expect(wakaclockV2Client.get).toHaveBeenCalledWith('/me/agents/universe', { params });
});

it('requests live agent activity for the signed-in account only', async () => {
  expect(await getAgentLive()).toEqual({ events: [] });
  expect(wakaclockV2Client.get).toHaveBeenCalledWith('/me/agents/live');
});

it('requests the signed-in member events inside one organization', async () => {
  const params = { end: '2026-08-02', start: '2026-08-01', timezone: 'Asia/Bangkok' };

  expect(await getReplayEvents('org-1', params)).toEqual({ events: [] });
  expect(wakaclockV2Client.get).toHaveBeenCalledWith(
    '/organizations/org-1/me/github/replay-events',
    { params }
  );
});
