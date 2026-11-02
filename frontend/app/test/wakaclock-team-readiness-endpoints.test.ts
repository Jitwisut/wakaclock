import { beforeEach, expect, it, vi } from 'vitest';
import { getTeamReadiness } from '@/lib/wakaclock/team-readiness-endpoints';
const mocks = vi.hoisted(() => ({ token: 'session-a', get: vi.fn() }));
vi.mock('@/lib/wakaclock/session', () => ({ getCurrentToken: () => mocks.token }));
vi.mock('@/lib/wakaclock/client-v2', () => ({
  wakaclockV2Client: { get: mocks.get },
  unwrapV2: (value: unknown) => value,
}));
beforeEach(() => {
  mocks.token = 'session-a';
  mocks.get.mockReset().mockResolvedValue({});
});
it('refuses a changed session before issuing a request', async () => {
  mocks.token = 'session-b';
  await expect(getTeamReadiness('org', 'session-a')).rejects.toThrow(/session changed/);
  expect(mocks.get).not.toHaveBeenCalled();
});
it('rejects an interceptor choosing another identity and a late old-session response', async () => {
  await getTeamReadiness('org', 'session-a');
  const config = mocks.get.mock.calls[0][1];
  expect(() => config.transformRequest[0](undefined, { get: () => 'Bearer session-b' })).toThrow(
    /unconfirmed/
  );
  let finish!: (value: unknown) => void;
  mocks.get.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const request = getTeamReadiness('org', 'session-a');
  mocks.token = 'session-b';
  finish({});
  await expect(request).rejects.toThrow(/session changed/);
});
