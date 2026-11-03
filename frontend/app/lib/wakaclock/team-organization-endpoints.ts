import { env } from '@/lib/env';

import { unwrapV2, wakaclockV2Client } from './client-v2';
import { getCurrentToken } from './session';

import type { Organization } from './measurement-types';
import type { V2Envelope } from './types';

export interface PendingOrganizationCreation {
  name: string;
  origin: string;
  requestId: string;
  userId: string;
  version: 1;
}

const origin = () => env.NEXT_PUBLIC_WAKACLOCK_API_URL;
const storageKey = (userId: string) =>
  `atoaxis-team-organization-create:v1:${encodeURIComponent(origin())}:${userId}`;
const uuid = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

/** Persist only form/operation metadata. Never persist credentials or silently
 * discard an unresolved operation after a lost response/account switch. */
export function readPendingOrganizationCreation(
  userId: string
): null | PendingOrganizationCreation {
  if (!userId) throw new Error('Sign in before creating an organization.');
  const saved = localStorage.getItem(storageKey(userId));
  if (saved === null) return null;
  const value = JSON.parse(saved) as PendingOrganizationCreation;
  if (
    !value ||
    Object.keys(value).sort().join(',') !== 'name,origin,requestId,userId,version' ||
    value.version !== 1 ||
    value.userId !== userId ||
    value.origin !== origin() ||
    typeof value.requestId !== 'string' ||
    !uuid.test(value.requestId) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    new TextEncoder().encode(value.name).length > 160
  ) {
    throw new Error('Saved organization request needs review; it has been preserved.');
  }
  return value;
}

export function prepareOrganizationCreation(userId: string, name: string) {
  const existing = readPendingOrganizationCreation(userId);
  if (existing) return { original: existing, firstAttempt: false };
  const trimmed = name.trim();
  if (!trimmed || new TextEncoder().encode(trimmed).length > 160) {
    throw new Error('Enter an organization name of at most 160 UTF-8 bytes.');
  }
  const request: PendingOrganizationCreation = {
    version: 1,
    userId,
    origin: origin(),
    requestId: crypto.randomUUID(),
    name: trimmed,
  };
  localStorage.setItem(storageKey(userId), JSON.stringify(request));
  const retained = readPendingOrganizationCreation(userId);
  if (JSON.stringify(retained) !== JSON.stringify(request)) {
    throw new Error('Organization request changed before sending; reload to review it.');
  }
  return { original: request, firstAttempt: true };
}

export function finishOrganizationCreation(userId: string, original: PendingOrganizationCreation) {
  const retained = readPendingOrganizationCreation(userId);
  if (JSON.stringify(retained) !== JSON.stringify(original)) {
    throw new Error('Saved organization request changed; it has been preserved.');
  }
  localStorage.removeItem(storageKey(userId));
}

/** Session fence shared by creation and explicit metadata-only recovery. */
async function organizationWrite<T>(
  payload: Record<string, unknown>,
  expectedSessionToken: string
) {
  const requireSession = () => {
    if (!expectedSessionToken || getCurrentToken() !== expectedSessionToken) {
      throw new Error(
        'Session changed before organization confirmation. Keep the original request.'
      );
    }
  };
  requireSession();
  let transformers = wakaclockV2Client.defaults.transformRequest ?? [];
  if (!Array.isArray(transformers)) transformers = [transformers];
  const result = unwrapV2(
    await wakaclockV2Client.post<V2Envelope<T>>('/organizations', payload, {
      transformRequest: [
        (body, headers) => {
          // Runs after the shared auth interceptor, immediately before dispatch.
          // Inspect its selection; never set our own Authorization header.
          requireSession();
          if (headers.get('Authorization') !== `Bearer ${expectedSessionToken}`) {
            throw new Error('Session dispatch is unconfirmed. Keep the original request.');
          }
          return body;
        },
        ...transformers,
      ],
    })
  );
  requireSession();
  return result;
}

// POST /organizations — the nonce is a retry key; identity comes from auth.
export async function postOrganizationCreation(
  original: PendingOrganizationCreation,
  expectedSessionToken: string
) {
  if (original.origin !== origin()) throw new Error('Organization server changed; reload first.');
  const result = await organizationWrite<
    {
      creation_receipt?: { disposition: string; request_id: string; schema: number };
    } & Organization
  >({ name: original.name, creation_request_id: original.requestId }, expectedSessionToken);
  if (
    result.creation_receipt?.schema !== 1 ||
    result.creation_receipt.request_id !== original.requestId ||
    result.creation_receipt.disposition !== 'confirmed'
  ) {
    throw new Error(
      'Server did not confirm durable creation of this original request. Keep it for recovery.'
    );
  }
  return result;
}

export interface OrganizationBirthRecovery {
  birth_digest: string;
  can_confirm: boolean;
  confirmation_id: null | string;
  confirmation_recorded: boolean;
  creates_organization: false;
  creation_id: string;
  disposition: 'confirmation_requested' | 'confirmation_required' | 'confirmed';
  observation: string;
  organization_id: string;
  schema: 1;
  starts_trial: false;
}
function recoveryResult(result: { creation_recovery?: OrganizationBirthRecovery }, org: string) {
  const value = result.creation_recovery;
  if (
    !value ||
    value.schema !== 1 ||
    value.organization_id !== org ||
    !uuid.test(value.creation_id) ||
    !/^[\da-f]{64}$/.test(value.birth_digest) ||
    !/^[\da-f]{64}$/.test(value.observation) ||
    !['confirmation_required', 'confirmation_requested', 'confirmed'].includes(value.disposition) ||
    typeof value.can_confirm !== 'boolean' ||
    typeof value.confirmation_recorded !== 'boolean' ||
    (value.confirmation_id !== null && !uuid.test(value.confirmation_id)) ||
    value.creates_organization !== false ||
    value.starts_trial !== false
  ) {
    throw new Error('Organization confirmation status is unavailable. No replacement was created.');
  }
  return value;
}
export async function inspectOrganizationBirth(org: string, expectedSessionToken: string) {
  const result = await organizationWrite<{ creation_recovery?: OrganizationBirthRecovery }>(
    {
      action: 'inspect_birth',
      organization_id: org,
    },
    expectedSessionToken
  );
  return recoveryResult(result, org);
}
export async function confirmOrganizationBirth(
  org: string,
  observed: OrganizationBirthRecovery,
  confirmationId: string,
  expectedSessionToken: string
) {
  if (observed.organization_id !== org || !observed.can_confirm || !uuid.test(confirmationId)) {
    throw new Error('Review the current organization confirmation status first.');
  }
  const result = await organizationWrite<{ creation_recovery?: OrganizationBirthRecovery }>(
    {
      action: 'confirm_birth',
      organization_id: org,
      creation_id: observed.creation_id,
      expected_birth_digest: observed.birth_digest,
      expected_observation: observed.observation,
      confirmation_id: confirmationId,
    },
    expectedSessionToken
  );
  const value = recoveryResult(result, org);
  if (
    value.confirmation_id !== confirmationId ||
    !value.confirmation_recorded ||
    value.disposition !== 'confirmed'
  ) {
    throw new Error('Confirmation remains unconfirmed. Check the saved request status.');
  }
  return value;
}
