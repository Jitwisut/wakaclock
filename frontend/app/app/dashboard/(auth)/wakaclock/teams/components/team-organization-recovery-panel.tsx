'use client';

import { useEffect, useRef, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  confirmOrganizationBirth,
  inspectOrganizationBirth,
  type OrganizationBirthRecovery,
} from '@/lib/wakaclock/team-organization-endpoints';

type Review = { id: string; observed: OrganizationBirthRecovery };

export function TeamOrganizationRecoveryPanel({
  userId,
  organizationId,
  sessionToken,
}: {
  organizationId: string;
  sessionToken: null | string;
  userId: string;
}) {
  const client = useQueryClient();
  const live = useRef(false);
  const original = useRef<null | Review>(null);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState('');
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const key = wakaclockKeys.teamOrganizationBirth(userId, organizationId, sessionToken);
  const status = useQuery({
    queryKey: key,
    queryFn: () => inspectOrganizationBirth(organizationId, sessionToken ?? ''),
    enabled: open && Boolean(userId) && Boolean(sessionToken),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const change = useMutation({
    mutationFn: (review: Review) =>
      confirmOrganizationBirth(organizationId, review.observed, review.id, sessionToken ?? ''),
    retry: false,
    onSuccess: async () => {
      if (!live.current) return;
      original.current = null;
      setConfirmed('');
      await client.invalidateQueries({ queryKey: key });
      await client.invalidateQueries({ queryKey: wakaclockKeys.teamTrial(userId, organizationId) });
    },
  });
  const available = status.isSuccess && !status.isFetching && !change.isPending && !change.isError;
  const data = available ? status.data : undefined;
  const confirmation = data
    ? `${data.creation_id}:${data.observation}:${data.confirmation_id ?? ''}`
    : '';
  return (
    <section aria-label="Organization creation recovery" className="space-y-2 rounded border p-3">
      <Button
        onClick={() => {
          setOpen(!open);
          setConfirmed('');
        }}
        variant="outline"
      >
        {open ? 'Close creation verification' : 'Verify organization creation (Owner)'}
      </Button>
      {open && (
        <>
          <p>
            Verify the already stored organization when its creation response was lost or its Owner
            changed. This cannot create another organization, start a trial, or enable sharing.
          </p>
          <Button
            disabled={status.isFetching || change.isPending}
            onClick={async () => {
              setConfirmed('');
              const refreshed = await status.refetch();
              if (!live.current) return;
              if (refreshed.isSuccess && refreshed.data) {
                // Explicit readback may discover the original accepted SQL request,
                // including after reload. A failed check never clears the old one.
                if (refreshed.data.confirmation_id) {
                  original.current = {
                    observed: refreshed.data,
                    id: refreshed.data.confirmation_id,
                  };
                }
                change.reset();
              }
            }}
            variant="outline"
          >
            Reload creation verification
          </Button>
          <QueryState
            error={status.error ?? change.error}
            isLoading={status.isLoading || change.isPending}
          >
            {data && (
              <>
                <p>Creation status: {data.disposition}</p>
                {data.confirmation_recorded && (
                  <p>
                    The original confirmation request is recorded. Trial and sharing remain separate
                    actions.
                  </p>
                )}
                {!data.can_confirm &&
                  !data.confirmation_recorded &&
                  data.disposition !== 'confirmed' && (
                    <p>
                      Confirmation is disabled or its prerequisites need administrator review.
                      Existing evidence is preserved.
                    </p>
                  )}
                {data.can_confirm && (
                  <>
                    <label className="flex items-center gap-2">
                      <input
                        aria-label="Confirm existing organization birth"
                        checked={confirmed === confirmation}
                        onChange={(event) => setConfirmed(event.target.checked ? confirmation : '')}
                        type="checkbox"
                      />
                      I authorize checking and confirming this existing organization as its current
                      Owner.
                    </label>
                    <Button
                      disabled={confirmed !== confirmation}
                      onClick={() => {
                        let review = original.current;
                        if (data.confirmation_id) {
                          review = { observed: data, id: data.confirmation_id };
                        }
                        if (!review) review = { observed: data, id: crypto.randomUUID() };
                        original.current = review;
                        change.mutate(review);
                        setConfirmed('');
                      }}
                    >
                      {data.confirmation_id
                        ? 'Check saved creation confirmation'
                        : 'Confirm existing creation'}
                    </Button>
                  </>
                )}
              </>
            )}
          </QueryState>
          {change.isError && (
            <p>
              The result is unconfirmed. Reload status to find the saved request; missing data is
              never recreated.
            </p>
          )}
        </>
      )}
    </section>
  );
}
