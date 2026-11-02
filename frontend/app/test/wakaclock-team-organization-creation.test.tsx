import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { TeamOrganizationCreatePanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-organization-create-panel';
import {
  finishOrganizationCreation,
  inspectOrganizationBirth,
  confirmOrganizationBirth,
  postOrganizationCreation,
  prepareOrganizationCreation,
  readPendingOrganizationCreation,
} from '@/lib/wakaclock/team-organization-endpoints';
import { WakaclockError } from '@/lib/wakaclock/client';
import { setCurrentToken } from '@/lib/wakaclock/session';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/wakaclock/client-v2', () => ({
  wakaclockV2Client: { post: api.post, defaults: { transformRequest: [] } },
  unwrapV2: (response: { data: { data: unknown } }) => response.data.data,
}));
beforeEach(() => {
  localStorage.clear();
  api.post.mockReset();
  setCurrentToken('synthetic-owner-session');
});
function mount(user = 'owner') {
  const cache = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = (actor: string) => (
    <QueryClientProvider client={cache}>
      <TeamOrganizationCreatePanel
        key={actor}
        userId={actor}
        sessionToken={`synthetic-${actor}-session`}
      />
    </QueryClientProvider>
  );
  return { ...render(view(user)), view };
}
it('retains original request and body over retries/reload without sending another account draft', () => {
  const { original } = prepareOrganizationCreation('owner', ' Synthetic Team ');
  expect(prepareOrganizationCreation('owner', 'changed draft')).toEqual({
    original,
    firstAttempt: false,
  });
  expect(readPendingOrganizationCreation('owner')).toEqual(original);
  expect(readPendingOrganizationCreation('other')).toBeNull();
  expect(() => finishOrganizationCreation('other', original)).toThrow();
  expect(readPendingOrganizationCreation('owner')).toEqual(original);
  expect(original.name).toBe('Synthetic Team');
  expect(Object.keys(original).sort()).toEqual([
    'name',
    'origin',
    'requestId',
    'userId',
    'version',
  ]);
});
it('preserves corrupted/unrecognized records instead of replacing their identities', () => {
  const { original } = prepareOrganizationCreation('owner', 'Synthetic Team');
  const key = localStorage.key(0)!;
  const malformed = JSON.stringify({ ...original, prompt: 'forbidden-field' });
  localStorage.setItem(key, malformed);
  expect(() => prepareOrganizationCreation('owner', 'replacement')).toThrow();
  expect(localStorage.getItem(key)).toBe(malformed);
});
it('does not submit an original form under a switched session', async () => {
  const { original } = prepareOrganizationCreation('owner', 'Synthetic Team');
  setCurrentToken('synthetic-other-session');
  await expect(postOrganizationCreation(original, 'synthetic-owner-session')).rejects.toThrow();
  expect(api.post).not.toHaveBeenCalled();
  expect(readPendingOrganizationCreation('owner')).toEqual(original);
});
it('uses a credential-free observation in cache keys across session refresh/logout', () => {
  const first = wakaclockKeys.teamOrganizationBirth('owner', 'org', 'synthetic-owner-session');
  expect(JSON.stringify(first)).not.toContain('synthetic-owner-session');
  expect(wakaclockKeys.teamOrganizationBirth('owner', 'org', 'synthetic-owner-session')).toEqual(
    first
  );
  setCurrentToken('synthetic-refreshed-session');
  const changed = wakaclockKeys.teamOrganizationBirth(
    'owner',
    'org',
    'synthetic-refreshed-session'
  );
  expect(changed).not.toEqual(first);
  expect(JSON.stringify(changed)).not.toContain('synthetic-refreshed-session');
  setCurrentToken(null);
  expect(
    wakaclockKeys.teamOrganizationBirth('owner', 'org', 'synthetic-refreshed-session').at(-1)
  ).toBe('unconfirmed');
});
it('uses explicit recovery actions and requires the original confirmed receipt without creating a replacement', async () => {
  const org = crypto.randomUUID();
  const id = crypto.randomUUID();
  const value = {
    schema: 1 as const,
    organization_id: org,
    creation_id: crypto.randomUUID(),
    birth_digest: 'a'.repeat(64),
    observation: 'b'.repeat(64),
    disposition: 'confirmation_required' as const,
    confirmation_id: null,
    confirmation_recorded: false,
    can_confirm: true,
    creates_organization: false as const,
    starts_trial: false as const,
  };
  api.post.mockResolvedValueOnce({ data: { data: { creation_recovery: value } } });
  const inspected = await inspectOrganizationBirth(org, 'synthetic-owner-session');
  expect(api.post.mock.calls[0][1]).toEqual({ action: 'inspect_birth', organization_id: org });
  api.post.mockResolvedValueOnce({
    data: {
      data: {
        creation_recovery: {
          ...value,
          confirmation_id: id,
          confirmation_recorded: true,
          can_confirm: false,
          disposition: 'confirmed',
        },
      },
    },
  });
  await confirmOrganizationBirth(org, inspected, id, 'synthetic-owner-session');
  expect(api.post.mock.calls[1][1]).toEqual({
    action: 'confirm_birth',
    organization_id: org,
    creation_id: value.creation_id,
    expected_birth_digest: value.birth_digest,
    expected_observation: value.observation,
    confirmation_id: id,
  });
  expect(JSON.stringify(api.post.mock.calls[1][1])).not.toContain('synthetic-owner-session');
  api.post.mockResolvedValueOnce({
    data: {
      data: {
        creation_recovery: {
          ...value,
          confirmation_id: crypto.randomUUID(),
          confirmation_recorded: true,
          disposition: 'confirmed',
        },
      },
    },
  });
  await expect(
    confirmOrganizationBirth(org, inspected, id, 'synthetic-owner-session')
  ).rejects.toThrow();
});
it('lost response retries the exact original nonce after remount and clears it only on confirmed success', async () => {
  api.post.mockRejectedValueOnce(new WakaclockError('response lost', null));
  const first = mount();
  fireEvent.change(await screen.findByLabelText('Organization name'), {
    target: { value: 'Synthetic Team' },
  });
  fireEvent.click(screen.getByText('Create'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  await screen.findByText(/Creation is unconfirmed/);
  const original = api.post.mock.calls[0][1];
  expect(original).toMatchObject({ name: 'Synthetic Team' });
  first.unmount();
  api.post.mockImplementation(async (_path, body) => ({
    data: {
      data: {
        id: 'known-org',
        creation_receipt: {
          schema: 1,
          request_id: body.creation_request_id,
          disposition: 'confirmed',
        },
      },
    },
  }));
  mount();
  fireEvent.click(await screen.findByText('Retry saved organization request'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).toEqual(original);
  await waitFor(() => expect(readPendingOrganizationCreation('owner')).toBeNull());
});
it('does not send if local persistence fails', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('write denied');
  });
  const ui = mount();
  fireEvent.change(await screen.findByLabelText('Organization name'), {
    target: { value: 'Synthetic Team' },
  });
  fireEvent.click(screen.getByText('Create'));
  await screen.findByText(/The local request could not be saved/);
  expect(api.post).not.toHaveBeenCalled();
  ui.unmount();
  storage.mockRestore();
});
it('an old server success and later slug conflict cannot disprove the original request', async () => {
  api.post.mockResolvedValueOnce({ data: { data: { id: 'old-server-org' } } });
  mount();
  fireEvent.change(await screen.findByLabelText('Organization name'), {
    target: { value: 'Synthetic Team' },
  });
  fireEvent.click(screen.getByText('Create'));
  await screen.findByText(/Creation is unconfirmed/);
  const original = readPendingOrganizationCreation('owner');
  api.post.mockRejectedValueOnce(new WakaclockError('organization slug is already in use', 400));
  fireEvent.click(screen.getByText('Retry saved organization request'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByText('Retry saved organization request')).toBeEnabled());
  expect(readPendingOrganizationCreation('owner')).toEqual(original);
});
it('an old account response cannot clear a new account form or pending operation', async () => {
  let finish!: (value: unknown) => void;
  api.post.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const ui = mount();
  fireEvent.change(await screen.findByLabelText('Organization name'), {
    target: { value: 'Synthetic Team' },
  });
  fireEvent.click(screen.getByText('Create'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const original = readPendingOrganizationCreation('owner');
  setCurrentToken('synthetic-other-session');
  ui.rerender(ui.view('other'));
  expect(await screen.findByLabelText('Organization name')).toHaveValue('');
  await act(async () => {
    finish({ data: { data: { id: 'known-org' } } });
  });
  expect(readPendingOrganizationCreation('owner')).toEqual(original);
  expect(screen.getByLabelText('Organization name')).toHaveValue('');
});
