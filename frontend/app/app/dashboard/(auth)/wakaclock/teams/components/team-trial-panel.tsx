'use client';

import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  reportTeamBillingAccessFailure,
  useTeamBillingAccessLossReport,
} from '@/lib/wakaclock/team-billing-recovery';
import {
  getTeamTrial,
  recoverTeamTrial,
  startTeamTrial,
} from '@/lib/wakaclock/team-trial-endpoints';

import {
  TeamBillingOwnerBoundary,
  useOptionalTeamBillingOwnerBoundary,
  useTeamBillingOwnerBoundary,
} from './team-billing-owner-boundary';

interface Props {
  organizationId: string;
  userId: string;
}
export function TeamTrialPanel(props: Props) {
  const boundary = useOptionalTeamBillingOwnerBoundary();
  const content = <TrialScope key={`${props.userId}:${props.organizationId}`} {...props} />;
  return boundary ? (
    content
  ) : (
    <TeamBillingOwnerBoundary key={`${props.userId}:${props.organizationId}`}>
      {content}
    </TeamBillingOwnerBoundary>
  );
}
function TrialScope({ organizationId, userId }: Props) {
  const boundary = useTeamBillingOwnerBoundary();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState(10);
  const [confirmed, setConfirmed] = useState('');
  const key = wakaclockKeys.teamTrial(userId, organizationId);
  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getTeamTrial(organizationId, signal),
    enabled: open && Boolean(userId) && !boundary.error,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: open && !boundary.error ? 15_000 : false,
  });
  useTeamBillingAccessLossReport(status.error, boundary.report);
  const change = useMutation({
    mutationFn: (
      action:
        | { kind: 'recover'; revision: number; transition: string }
        | { kind: 'start'; seats: number }
    ) =>
      reportTeamBillingAccessFailure(
        action.kind === 'start'
          ? startTeamTrial(organizationId, action.seats)
          : recoverTeamTrial(organizationId, action.transition, action.revision),
        boundary.report
      ),
    retry: false,
    onSuccess: async () => {
      setConfirmed('');
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: wakaclockKeys.teamHealth(userId, organizationId) }),
      ]);
    },
  });
  const data =
    !boundary.error &&
    status.isSuccess &&
    !status.isFetching &&
    !change.isPending &&
    !change.isError
      ? status.data
      : undefined;
  const contract =
    data &&
    data.trial_days === 14 &&
    data.payment_card_required === false &&
    data.personal_capture_affected === false &&
    Number.isSafeInteger(data.developer_seats) &&
    data.developer_seats >= 0 &&
    Array.isArray(data.packages);
  const start =
    contract &&
    data.disposition === 'not_started' &&
    data.can_start &&
    [10, 25, 50, 100].includes(seats) &&
    data.packages.includes(seats) &&
    seats >= data.developer_seats;
  const recovery =
    contract && data.disposition === 'recovery_required' && data.recovery?.expected_revision === 1
      ? data.recovery
      : undefined;
  const confirmation = data
    ? `${userId}:${organizationId}:${seats}:${data.entitlement_revision}:${data.observed_at}:${recovery?.transition_id ?? ''}:${boundary.revision}`
    : '';
  return (
    <section aria-label="Team trial" className="space-y-2 rounded border p-3">
      <Button
        onClick={() => {
          setOpen(!open);
          setConfirmed('');
        }}
        variant="outline"
      >
        {open ? 'Close trial status' : 'Team trial (Owner)'}
      </Button>
      {open && (
        <>
          <p>
            A one-time 14-day trial without a payment card. Sharing remains each member’s choice.
          </p>
          <Button
            disabled={status.isFetching || change.isPending}
            onClick={async () => {
              change.reset();
              setConfirmed('');
              await boundary.reload(() => status.refetch());
            }}
            variant="outline"
          >
            Reload trial status
          </Button>
          <QueryState
            error={boundary.error ?? change.error ?? status.error}
            isLoading={status.isFetching || change.isPending || status.isLoading}
          >
            {data && (
              <>
                <p>Trial status: {data.disposition}</p>
                <p>
                  Current developer seats: {data.developer_seats}. Viewers do not use developer
                  seats.
                </p>
                {data.package_seats !== null && (
                  <p>Saved package: {data.package_seats} developers.</p>
                )}
                {data.trial_started_at && <p>Original start: {data.trial_started_at}</p>}
                {data.trial_ends_at && <p>Trial ends: {data.trial_ends_at}</p>}
                {data.disposition === 'unconfirmed' && (
                  <p>
                    Financial history is unconfirmed. Reload or request operator review; do not
                    start a replacement trial.
                  </p>
                )}
                {data.disposition === 'recovery_required' && (
                  <p>
                    The trial is saved in the database but independent confirmation is pending.
                    Recovery checks that original transition and does not restart the trial.
                  </p>
                )}
                {data.disposition === 'expired' && (
                  <p>The original trial has ended. Reloading or recovery cannot extend it.</p>
                )}
                {data.disposition === 'subscription_managed' && (
                  <p>
                    This organization already has subscription-managed coverage. Another trial
                    cannot be started.
                  </p>
                )}
                <p>
                  {data.analytics_status === 'observed'
                    ? 'Privacy and enrollment agreement observed. Consent and fact admission still control reports.'
                    : 'Analytics remain withheld while independent privacy or enrollment evidence is unconfirmed. Check Trust; a saved trial does not make reports ready.'}
                </p>
                {data.reason === 'existing_purchase_requires_review' && (
                  <p>Review the existing purchase before starting a trial.</p>
                )}
                {data.reason === 'developer_capacity_exceeded' && (
                  <p>
                    The current developer count is above the supported packages. Review membership
                    with the organization Owner.
                  </p>
                )}
                {!contract && (
                  <p>
                    The trial contract is unavailable in this client; reload after checking
                    compatibility.
                  </p>
                )}
                {contract && data.disposition === 'not_started' && data.can_start && (
                  <label>
                    Trial developer package
                    <select
                      aria-label="Trial developer package"
                      onChange={(event) => {
                        setSeats(Number(event.target.value));
                        setConfirmed('');
                      }}
                      value={seats}
                    >
                      {[10, 25, 50, 100]
                        .filter((n) => data.packages.includes(n))
                        .map((n) => (
                          <option disabled={n < data.developer_seats} key={n} value={n}>
                            {n}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {(start || recovery) && (
                  <>
                    <label className="flex items-center gap-2">
                      <input
                        aria-label="Confirm trial action"
                        checked={confirmed === confirmation}
                        onChange={(event) => setConfirmed(event.target.checked ? confirmation : '')}
                        type="checkbox"
                      />
                      {recovery
                        ? 'I authorize checking the original saved trial.'
                        : `I confirm the one-time 14-day trial for ${seats} developers. It begins when activation is first committed.`}
                    </label>
                    <Button
                      disabled={confirmed !== confirmation}
                      onClick={() =>
                        recovery
                          ? change.mutate({
                              kind: 'recover',
                              transition: recovery.transition_id,
                              revision: recovery.expected_revision,
                            })
                          : change.mutate({ kind: 'start', seats })
                      }
                    >
                      {recovery ? 'Recover original trial' : 'Start no-card trial'}
                    </Button>
                  </>
                )}
              </>
            )}
          </QueryState>
          {(status.isError || change.isError) && (
            <p>
              Unknown results are not a new trial opportunity. Reload status before retrying;
              unavailable is not “not started”.
            </p>
          )}
        </>
      )}
    </section>
  );
}
