'use client';

import { useEffect, useRef, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { QueryState } from '@/components/wakaclock/query-state';
import { WakaclockError } from '@/lib/wakaclock/client';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  finishOrganizationCreation,
  type PendingOrganizationCreation,
  postOrganizationCreation,
  prepareOrganizationCreation,
  readPendingOrganizationCreation,
} from '@/lib/wakaclock/team-organization-endpoints';

/** Parent keys this component by authenticated user so old callbacks cannot
 * clear another account's draft, form, or cached organization list. */
export function TeamOrganizationCreatePanel({
  userId,
  sessionToken,
}: {
  sessionToken: null | string;
  userId: string;
}) {
  const client = useQueryClient();
  const live = useRef(false);
  const attempt = useRef<null | PendingOrganizationCreation>(null);
  const firstAttempt = useRef(false);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState<null | PendingOrganizationCreation>(null);
  const [storageError, setStorageError] = useState<Error | null>(null);
  useEffect(() => {
    live.current = true;
    try {
      const saved = readPendingOrganizationCreation(userId);
      setPending(saved);
      if (saved) setName(saved.name);
      setStorageError(null);
    } catch {
      setStorageError(
        new Error(
          'Saved request is unavailable. No new request was sent; reload or contact support.'
        )
      );
    }
    setReady(true);
    return () => {
      live.current = false;
    };
  }, [userId]);
  const create = useMutation({
    retry: false,
    mutationFn: async () => {
      attempt.current = null;
      if (!sessionToken) throw new Error('Sign in before creating an organization.');
      const prepared = prepareOrganizationCreation(userId, name);
      const { original } = prepared;
      firstAttempt.current = prepared.firstAttempt;
      attempt.current = original;
      if (live.current) {
        setPending(original);
        setName(original.name);
      }
      await postOrganizationCreation(original, sessionToken);
      return original;
    },
    onSuccess: async (original) => {
      // Preserve unresolved metadata if this account has left the page. Its next
      // visit can confirm the same original request instead of inventing one.
      if (!live.current) return;
      try {
        finishOrganizationCreation(userId, original);
        setPending(null);
        setName('');
      } catch {
        setStorageError(
          new Error(
            'The server replied, but local confirmation is incomplete. Keep the saved request and reload.'
          )
        );
      }
      await client.invalidateQueries({ queryKey: wakaclockKeys.organizations(userId) });
    },
    onError: async (error) => {
      if (live.current) {
        if (!attempt.current) {
          setStorageError(
            new Error(
              'The local request could not be saved. No request was sent; existing data is preserved. Reload or contact support.'
            )
          );
        } else if (
          firstAttempt.current &&
          error instanceof WakaclockError &&
          error.status === 400 &&
          [
            'organization slug is already in use',
            'slug must contain 2-80 URL-safe characters',
            'organization name must contain 1-160 characters',
          ].includes(error.message)
        ) {
          // Only a first attempt can release a known pre-reservation error.
          // A prior unknown/older-server response cannot be disproved by a slug
          // collision on retry. Unknown
          // failures (including SQL unique races) never discard the original.
          try {
            finishOrganizationCreation(userId, attempt.current);
            setPending(null);
          } catch {
            setStorageError(
              new Error('Local request confirmation failed. Preserve it and reload.')
            );
          }
        }
        await client.invalidateQueries({ queryKey: wakaclockKeys.organizations(userId) });
      }
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an organization</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {storageError && <p role="alert">{storageError.message}</p>}
        <QueryState error={storageError} isLoading={!ready}>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Organization name"
              className="max-w-xs"
              disabled={Boolean(pending) || create.isPending}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
            <Button
              disabled={!userId || !name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {pending ? 'Retry saved organization request' : 'Create'}
            </Button>
          </div>
          {pending && (
            <p>
              The original request is saved for this account and server. Retry checks it without
              creating a replacement. Creating an organization does not start a trial or enable
              sharing.
            </p>
          )}
          {create.isError && (
            <p role="alert">
              {pending
                ? 'Creation is unconfirmed. Keep the saved request and retry after the service is available. New workspace onboarding must be enabled by the service administrator.'
                : 'The request was not submitted or was rejected before acceptance. Review the name and use an available URL-safe slug, then try again.'}
            </p>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
