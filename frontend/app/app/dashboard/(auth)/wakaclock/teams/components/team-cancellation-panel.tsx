'use client';

import { useEffect, useRef, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { WakaclockError } from '@/lib/wakaclock/client';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  reportTeamBillingAccessFailure,
  teamBillingRecoveryGuidance,
} from '@/lib/wakaclock/team-billing-recovery';
import {
  acceptTeamCancellation,
  getTeamCancellation,
  recoverTeamCancellation,
  type TeamCancellationSelection,
} from '@/lib/wakaclock/team-cancellation-endpoints';

import { useTeamBillingOwnerBoundary } from './team-billing-owner-boundary';

interface Props {
  authority: { available: boolean; observation: string };
  onAccessLost: (error: unknown) => void;
  organizationId: string;
  userId: string;
}
export function TeamCancellationPanel(props: Props) {
  return <CancellationScope key={`${props.userId}:${props.organizationId}`} {...props} />;
}
function CancellationScope({ organizationId, userId, authority, onAccessLost }: Props) {
  const boundary = useTeamBillingOwnerBoundary();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [original, setOriginal] = useState<null | TeamCancellationSelection>(null);
  const originalRef = useRef<null | TeamCancellationSelection>(null);
  const [unresolvedOriginal, setUnresolvedOriginal] = useState(false);
  const reportedError = useRef<unknown>(null);
  const key = wakaclockKeys.teamCancellation(userId, organizationId, original?.operation_id);
  const access = authority.available && !boundary.error && Boolean(userId);
  const change = useMutation({
    mutationFn: (
      action:
        | { kind: 'accept'; selection: TeamCancellationSelection }
        | { kind: 'recover'; operation: string; revision: number }
    ) => {
      if (!access) return Promise.reject(new Error('Billing Owner check required'));
      return reportTeamBillingAccessFailure(
        action.kind === 'accept'
          ? acceptTeamCancellation(organizationId, action.selection)
          : recoverTeamCancellation(organizationId, action.operation, action.revision),
        onAccessLost
      );
    },
    retry: false,
    onError: (_error, action) => {
      if (action.kind === 'accept') setUnresolvedOriginal(true);
    },
    onSuccess: async () => {
      setUnresolvedOriginal(false);
      setConfirmation('');
      await client.invalidateQueries({
        queryKey: wakaclockKeys.teamCancellation(userId, organizationId),
      });
      await client.invalidateQueries({ queryKey: key });
    },
  });
  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getTeamCancellation(organizationId, original?.operation_id, signal),
    enabled: open && access && !change.isPending,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: open && access && !change.isPending ? 15_000 : false,
  });
  useEffect(() => {
    if (status.error !== reportedError.current) {
      reportedError.current = status.error;
      if (status.error instanceof WakaclockError && [401, 403].includes(status.error.status ?? 0)) {
        onAccessLost(status.error);
      }
    }
  }, [status.error, onAccessLost]);
  const data =
    access && status.isSuccess && !status.isFetching && !change.isPending && !change.isError
      ? status.data
      : undefined;
  const operation = data?.operation;
  const selection = data?.schema_version === 1 && !operation ? data.selection : null;
  const selectable =
    selection &&
    Number.isSafeInteger(selection.binding_revision) &&
    selection.binding_revision > 0 &&
    Number.isSafeInteger(selection.source_revision) &&
    selection.source_revision > 0 &&
    Date.parse(selection.period_end) > Date.now() &&
    Date.parse(selection.confirmation_expires_at) > Date.now();
  const recoverable =
    operation &&
    !['effective', 'withdrawn'].includes(operation.state) &&
    (operation.authorization_current_owner === false ||
      ['owner_changed', 'recovery_required', 'changed'].includes(operation.state)) &&
    operation.worker_configured === true &&
    Number.isSafeInteger(operation.revision) &&
    operation.revision > 0;
  const signature = data
    ? `${userId}:${organizationId}:${data.checked_at}:${operation?.operation_id ?? ''}:${operation?.revision ?? ''}:${selection?.period_end ?? ''}:${authority.observation}:${boundary.revision}`
    : '';
  const retrySignature = original
    ? `${original.operation_id}:${authority.observation}:${boundary.revision}:retry`
    : '';
  const inspectedAfterFailure =
    unresolvedOriginal && !status.isFetching && (status.isSuccess || status.isError);
  const submit = () => {
    if (
      !access ||
      !selectable ||
      !selection ||
      Date.parse(selection.confirmation_expires_at) <= Date.now() ||
      confirmation !== signature
    ) {
      return;
    }
    // Freeze the original request before starting the mutation. Unknown response
    // retries always reuse this exact identity/terms, never a new random ID.
    const request: TeamCancellationSelection = originalRef.current ?? {
      operation_id: crypto.randomUUID(),
      expected_binding_revision: selection.binding_revision,
      expected_source_revision: selection.source_revision,
      expected_period_end: selection.period_end,
      confirm: true,
    };
    originalRef.current = request;
    setOriginal(request);
    setConfirmation('');
    change.mutate({ kind: 'accept', selection: request });
  };
  return (
    <section aria-label="Subscription cancellation" className="space-y-2 rounded border p-3">
      <Button
        onClick={() => {
          setOpen(!open);
          setConfirmation('');
        }}
        variant="outline"
      >
        {open ? 'Close cancellation status' : 'Cancel at period end (Owner)'}
      </Button>
      {open && (
        <>
          <p>
            Request cancellation at the confirmed billing boundary. Current access follows the
            subscription policy; this does not immediately delete members or personal activity.
          </p>
          <Button
            disabled={!access || change.isPending || status.isFetching}
            onClick={async () => {
              change.reset();
              setConfirmation('');
              await status.refetch();
            }}
            variant="outline"
          >
            Reload cancellation status
          </Button>
          <QueryState
            error={boundary.error ?? status.error ?? change.error}
            isLoading={status.isLoading || status.isFetching || change.isPending}
          >
            {access && data && (
              <>
                {operation && (
                  <>
                    <p>Saved request: {operation.operation_id}</p>
                    <p>Cancellation state: {operation.state}</p>
                    <p>Requested boundary: {operation.expected_period_end} (UTC)</p>
                    <p>Provider evidence: {operation.provider_disposition ?? 'unconfirmed'}</p>
                    <p>Provider observed: {operation.provider_observed_at ?? 'unconfirmed'}</p>
                    <p>Next eligible check: {operation.retry_at}</p>
                    {operation.authorization_current_owner === false &&
                      !['effective', 'withdrawn'].includes(operation.state) && (
                        <p>
                          The current Owner must explicitly authorize reading this saved operation.
                          The original cancellation will not be sent again by that recovery action.
                        </p>
                      )}
                    {operation.reason === 'provider_observation_stale' && (
                      <p>
                        Provider evidence is stale. The last observation does not confirm current
                        state.
                      </p>
                    )}
                    {operation.worker_configured !== true && (
                      <p>
                        Automatic checks are disabled or configuration is unconfirmed. The saved
                        request is retained.
                      </p>
                    )}
                    {operation.last_error_code && (
                      <p>{teamBillingRecoveryGuidance(operation.last_error_code)}</p>
                    )}
                  </>
                )}
                {selectable && (
                  <p>
                    Confirmed period end: {selection.period_end} (UTC). Latest provider observation:{' '}
                    {selection.provider_observed_at}.
                  </p>
                )}
                {(selectable || recoverable) && (
                  <label className="flex items-center gap-2">
                    <input
                      aria-label="Confirm cancellation action"
                      checked={Boolean(signature) && confirmation === signature}
                      onChange={(event) => setConfirmation(event.target.checked ? signature : '')}
                      type="checkbox"
                    />
                    {selectable
                      ? 'I request cancellation at this confirmed period end.'
                      : 'I authorize reading the existing operation only.'}
                  </label>
                )}
                {selectable && (
                  <Button disabled={confirmation !== signature} onClick={submit}>
                    Request period-end cancellation
                  </Button>
                )}
                {recoverable && (
                  <Button
                    disabled={confirmation !== signature}
                    onClick={() => {
                      setConfirmation('');
                      change.mutate({
                        kind: 'recover',
                        operation: operation.operation_id,
                        revision: operation.revision,
                      });
                    }}
                  >
                    Check existing cancellation
                  </Button>
                )}
                {!operation && !selectable && (
                  <p>
                    No current subscription terms are confirmed. Reload before requesting
                    cancellation.
                  </p>
                )}
              </>
            )}
          </QueryState>
          {access && original && unresolvedOriginal && !operation && (
            <>
              <p>
                The response is unconfirmed. Reload the original operation before trying again; keep
                request {original.operation_id}.
              </p>
              {inspectedAfterFailure && (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      aria-label="Confirm original cancellation retry"
                      checked={confirmation === retrySignature}
                      onChange={(event) =>
                        setConfirmation(event.target.checked ? retrySignature : '')
                      }
                      type="checkbox"
                    />
                    Retry only this original request and its original boundary.
                  </label>
                  <Button
                    disabled={confirmation !== retrySignature}
                    onClick={() => {
                      setConfirmation('');
                      change.mutate({ kind: 'accept', selection: original });
                    }}
                  >
                    Retry original cancellation request
                  </Button>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
