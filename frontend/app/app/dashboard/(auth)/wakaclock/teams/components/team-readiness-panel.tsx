'use client';

import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getSessionObservation } from '@/lib/wakaclock/session';
import {
  getTeamReadiness,
  type TeamEvidenceRecord,
} from '@/lib/wakaclock/team-readiness-endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

function validRecords(rows: unknown): boolean {
  return (
    Array.isArray(rows) &&
    rows.every((value: unknown) => {
      if (!value || typeof value !== 'object') return false;
      const row = value as Record<string, unknown>;
      return (
        typeof row.gate === 'string' &&
        typeof row.recorded_passed === 'boolean' &&
        typeof row.evidence_ref === 'string' &&
        typeof row.checked_at === 'string' &&
        (row.build === null || typeof row.build === 'string') &&
        (row.build_matches_current === null || typeof row.build_matches_current === 'boolean') &&
        row.certified === false &&
        typeof row.reason === 'string' &&
        ['recorded', 'unconfirmed'].includes(String(row.metadata_status))
      );
    })
  );
}

function buildComparison(value: boolean | null): string {
  if (value === null) return 'unconfirmed';
  return value ? 'same recorded SHA' : 'different SHA';
}

function Records({ scope, rows }: { rows: TeamEvidenceRecord[]; scope: string }) {
  return (
    <section aria-label={`${scope} evidence records`}>
      <h5>{scope} records</h5>
      {rows.length === 0 && (
        <p>No {scope.toLowerCase()} records available. This does not mean verification passed.</p>
      )}
      <ul>
        {rows.map((row) => (
          <li key={row.gate}>
            <p>
              {row.gate}: recorded result {row.recorded_passed ? 'passed' : 'not passed'} · metadata{' '}
              {row.metadata_status} · {row.reason}
            </p>
            <p>
              Checked: {row.checked_at}. Recorded build: {row.build ?? 'unconfirmed'}.
            </p>
            <p>Build comparison: {buildComparison(row.build_matches_current)}.</p>
            <p>Evidence reference: {row.evidence_ref || 'unavailable'}.</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TeamReadinessPanel({ organizationId }: { organizationId: string }) {
  const user = useWakaclockUserStore((s) => s.userId) ?? '';
  const session = useWakaclockUserStore((s) => s.token);
  return (
    <ReadinessScope
      key={`${user}:${organizationId}:${getSessionObservation(session)}`}
      organizationId={organizationId}
      session={session}
      user={user}
    />
  );
}
function ReadinessScope({
  organizationId,
  session,
  user,
}: {
  organizationId: string;
  session: null | string;
  user: string;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: wakaclockKeys.teamReadiness(user, organizationId, session),
    queryFn: ({ signal }) => getTeamReadiness(organizationId, session ?? '', signal),
    enabled: open && Boolean(user && session) && getSessionObservation(session) !== 'unconfirmed',
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const data = !query.isError && !query.isFetching ? query.data : undefined;
  const detail =
    data?.production_ready === false &&
    data.checkout_available === false &&
    data.evidence_details?.schema_version === 1 &&
    data.evidence_details.external_certification === 'unconfirmed' &&
    validRecords(data.evidence_details.local) &&
    validRecords(data.evidence_details.external)
      ? data.evidence_details
      : undefined;
  return (
    <section aria-label="Recorded release evidence" className="mt-3 space-y-2 rounded border p-3">
      <Button disabled={!user || !session} onClick={() => setOpen(!open)} variant="outline">
        {open ? 'Close evidence review' : 'Review release evidence (Owner/Admin)'}
      </Button>
      {open && (
        <>
          <p>
            Recorded evidence is separate from certification. These records do not enable production
            or Checkout.
          </p>
          <Button
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            variant="outline"
          >
            Reload evidence records
          </Button>
          <QueryState error={query.error} isLoading={query.isLoading || query.isFetching}>
            {detail && (
              <>
                <p>
                  Current server build: {data?.build ?? 'unconfirmed'}. Evaluated:{' '}
                  {data?.evaluated_at}.
                </p>
                <p>
                  External certification: {detail.external_certification}. A matching SHA alone is
                  not certification.
                </p>
                {detail.unsupported_scope_present && (
                  <p>Some records have an unrecognized scope and remain unconfirmed.</p>
                )}
                <Records rows={detail.local} scope="Local" />
                <Records rows={detail.external} scope="External" />
              </>
            )}
            {data && !detail && (
              <p>
                Evidence details are unavailable in this server version. No readiness is inferred.
              </p>
            )}
          </QueryState>
        </>
      )}
    </section>
  );
}
