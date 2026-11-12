import { beforeEach, expect, it, vi } from 'vitest';

import { getTeamPortalDestination, isTeamPortalUrl } from '@/lib/wakaclock/team-portal-endpoints';
import {
  getTeamTrial,
  recoverTeamTrial,
  startTeamTrial,
} from '@/lib/wakaclock/team-trial-endpoints';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/wakaclock/client-v2', () => ({
  wakaclockV2Client: { get: mocks.get, post: mocks.post },
  unwrapV2: (response: { data: { data: unknown } }) => response.data.data,
}));
const envelope = (data: unknown) => ({ data: { data, meta: { request_id: 'r1' } } });
beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
});

it('reads trial status from the organization billing path and forwards cancellation', async () => {
  mocks.get.mockResolvedValue(envelope({ disposition: 'not_started' }));
  const abort = new AbortController();
  await expect(getTeamTrial('org-1', abort.signal)).resolves.toEqual({
    disposition: 'not_started',
  });
  expect(mocks.get).toHaveBeenCalledWith('/organizations/org-1/billing/trial', {
    signal: abort.signal,
  });
  expect(mocks.post).not.toHaveBeenCalled();
});
it('starts a trial with the chosen package and an explicit confirmation', async () => {
  mocks.post.mockResolvedValue(envelope({ disposition: 'active', package_seats: 25 }));
  await expect(startTeamTrial('org-1', 25)).resolves.toEqual({
    disposition: 'active',
    package_seats: 25,
  });
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(mocks.post).toHaveBeenCalledWith('/organizations/org-1/billing/trial', {
    package_seats: 25,
    confirm: true,
  });
});
it('recovers the original transition at its expected revision instead of starting again', async () => {
  mocks.post.mockResolvedValue(envelope({ disposition: 'active' }));
  await expect(recoverTeamTrial('org-1', 'transition-1', 1)).resolves.toEqual({
    disposition: 'active',
  });
  expect(mocks.post).toHaveBeenCalledWith('/organizations/org-1/billing/trial/recover', {
    transition_id: 'transition-1',
    expected_revision: 1,
    confirm: true,
  });
});
it('propagates a failed trial request without swallowing it', async () => {
  mocks.post.mockRejectedValue(new Error('trial unavailable'));
  await expect(startTeamTrial('org-1', 10)).rejects.toThrow('trial unavailable');
});
it('requests a portal destination bound to the caller-chosen request identity', async () => {
  const destination = { request_id: 'request-1', url: 'https://billing.stripe.com/p/session/a' };
  mocks.post.mockResolvedValue(envelope(destination));
  await expect(getTeamPortalDestination('org-1', 'request-1')).resolves.toEqual(destination);
  expect(mocks.post).toHaveBeenCalledWith('/organizations/org-1/billing/portal', {
    request_id: 'request-1',
    confirm: true,
  });
});
it('rejects portal values that are not a plain, bounded, printable provider URL', () => {
  expect(isTeamPortalUrl(undefined as unknown as string)).toBe(false);
  expect(isTeamPortalUrl('https://billing.stripe.com/p/session/a b')).toBe(false);
  expect(isTeamPortalUrl(`https://billing.stripe.com/p/session/${'a'.repeat(8192)}`)).toBe(false);
  // Printable, but not parseable as a URL at all.
  expect(isTeamPortalUrl('not-a-url')).toBe(false);
  // The right origin with any path other than the two documented session forms.
  expect(isTeamPortalUrl('https://billing.stripe.com/p/login/a')).toBe(false);
  expect(isTeamPortalUrl('https://billing.stripe.com/')).toBe(false);
  expect(isTeamPortalUrl('https://billing.stripe.com/p/session?token=a')).toBe(false);
  expect(isTeamPortalUrl('https://billing.stripe.com/p/session/a/b')).toBe(false);
  expect(isTeamPortalUrl('https://billing.stripe.com/p/session/a_B1')).toBe(true);
});
