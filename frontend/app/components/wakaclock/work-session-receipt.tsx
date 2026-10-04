'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  getSessionEvidence,
  getWorkSession,
  measuredLabel,
  receiptExport,
  sessionKeys,
  setSessionOutcome,
} from '@/lib/wakaclock/work-sessions';
import type { MeasuredValue, Outcome, WorkSessionReceipt } from '@/lib/wakaclock/work-sessions';

function Metric({ label, metric }: { label: string; metric: MeasuredValue }) {
  return (
    <div className="rounded-md border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-lg font-medium">{measuredLabel(metric)}</dd>
      <dd className="text-muted-foreground text-xs">
        {metric.coverage.status} · {metric.coverage.reported_events}/{metric.coverage.total_events}{' '}
        received records
      </dd>
    </div>
  );
}
function duration(value: null | number) {
  return value == null ? 'Not available' : `${value.toFixed(1)} seconds`;
}
function download(receipt: WorkSessionReceipt) {
  const url = URL.createObjectURL(new Blob([receiptExport(receipt)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `atoaxis-receipt-${receipt.id.slice(0, 12)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function WorkSessionReceiptDrawer({
  id,
  onClose,
  userId,
}: {
  id: string;
  onClose: () => void;
  userId: string;
}) {
  const client = useQueryClient();
  const receipt = useQuery({
    queryKey: sessionKeys.detail(userId, id),
    queryFn: () => getWorkSession(id),
  });
  const { data } = receipt;
  const evidence = useInfiniteQuery({
    queryKey: sessionKeys.evidence(userId, id, data?.revision_fingerprint),
    queryFn: ({ pageParam }) => getSessionEvidence(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: Boolean(data),
  });
  const mutation = useMutation({
    mutationFn: (outcome: null | Outcome) => setSessionOutcome(id, outcome),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: sessionKeys.detail(userId, id) });
    },
  });
  return (
    <Sheet onOpenChange={onClose} open>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Work Session Receipt</SheetTitle>
          <SheetDescription>
            One agent session. Received evidence, with missing measurements kept visible.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {receipt.isLoading && <p role="status">Loading receipt…</p>}
          {receipt.isError && (
            <p role="alert">
              Could not load this receipt.{' '}
              <Button onClick={() => void receipt.refetch()} variant="outline">
                Retry
              </Button>
            </p>
          )}
          {data && (
            <>
              {receipt.isError && (
                <p role="status">Showing the last loaded snapshot; it may be stale.</p>
              )}
              <div>
                <h3 className="font-semibold">
                  {data.agent} · {data.runtime_status}
                </h3>
                <p className="text-sm">
                  {new Date(data.observed_window.start * 1000).toLocaleString()} –{' '}
                  {new Date(data.observed_window.end * 1000).toLocaleString()}
                </p>
                <p className="text-muted-foreground text-xs">
                  Observed evidence window; this is not execution time. Identity:{' '}
                  {data.identity_status}.
                </p>
              </div>
              {data.identity_status === 'legacy_unresolved' && (
                <p role="status">
                  Collector or session scope is unresolved. Operations are not joined by guessing
                  from timestamps.
                </p>
              )}
              <section aria-label="Session projects">
                <h3 className="font-medium">Projects</h3>
                {data.project_ids.length > 0 ? (
                  <ul>
                    {data.project_ids.map((project) => (
                      <li className="text-sm break-all" key={project}>
                        {data.projects?.find((item) => item.id === project)?.name ||
                          `Project name unavailable (${project})`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">No assigned project</p>
                )}
                <p className="text-muted-foreground text-xs">
                  {data.usage.unassigned_project_events} usage records have no assigned project.
                  Session totals are not copied to each project.
                </p>
              </section>
              <section aria-label="Observed time">
                <h3 className="font-medium">Observed activity</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt>Human context in this window</dt>
                    <dd>{duration(data.time.human_context_seconds)}</dd>
                  </div>
                  <div>
                    <dt>Agent execution</dt>
                    <dd>{duration(data.time.agent_execution_seconds)}</dd>
                  </div>
                  <div>
                    <dt>Overlap</dt>
                    <dd>{duration(data.time.overlap_seconds)}</dd>
                  </div>
                  <div>
                    <dt>Combined observed activity</dt>
                    <dd>{duration(data.time.combined_observed_seconds)}</dd>
                  </div>
                </dl>
                <p className="text-muted-foreground mt-2 text-xs">
                  Human context does not prove work on this task or code authorship. Times across
                  receipts can overlap and must not be added together.
                </p>
                <p className="text-muted-foreground text-xs">
                  {data.time.reason.replaceAll('_', ' ')}
                </p>
              </section>
              <section aria-label="Reported usage">
                <h3 className="mb-2 font-medium">Reported usage</h3>
                <dl className="grid grid-cols-2 gap-3">
                  <Metric label="Input tokens" metric={data.usage.input_tokens} />
                  <Metric label="Output tokens" metric={data.usage.output_tokens} />
                  <Metric label="Cache read tokens" metric={data.usage.cache_read_tokens} />
                  <Metric label="Cache write tokens" metric={data.usage.cache_write_tokens} />
                  <Metric label="Prompt characters" metric={data.usage.prompt_characters} />
                  <Metric
                    label="Estimated cost (micro-USD)"
                    metric={data.usage.estimated_cost_microusd}
                  />
                </dl>
                <p className="text-muted-foreground mt-2 text-xs">
                  Coverage describes received records, not all vendor activity. Estimated cost is
                  not your subscription bill. Pricing:{' '}
                  {data.usage.pricing_versions.join(', ') || 'not available'}.
                </p>
              </section>
              <section aria-label="Line evidence">
                <h3 className="mb-2 font-medium">Measured line changes</h3>
                <dl className="grid grid-cols-2 gap-3">
                  <Metric label="Verified AI additions" metric={data.lines.verified_ai_added} />
                  <Metric label="Verified AI deletions" metric={data.lines.verified_ai_deleted} />
                </dl>
                <p className="text-muted-foreground mt-2 text-xs">
                  {data.lines.inferred_operations} inferred operations ·{' '}
                  {data.lines.unknown_operations} unknown operations. Changes do not measure
                  retained code or quality.
                </p>
                {data.lines.reason && (
                  <p className="text-sm">{data.lines.reason.replaceAll('_', ' ')}</p>
                )}
              </section>
              <section aria-label="User-reported outcome">
                <label className="block font-medium" htmlFor="session-outcome">
                  Your outcome
                </label>
                <select
                  className="mt-2 rounded-md border p-2"
                  disabled={!data.outcome_available || mutation.isPending}
                  id="session-outcome"
                  onChange={(event) =>
                    mutation.mutate((event.target.value || null) as null | Outcome)
                  }
                  value={data.outcome?.value ?? ''}
                >
                  <option value="">Not specified</option>
                  <option value="completed">Completed</option>
                  <option value="needs_work">Needs more work</option>
                  <option value="abandoned">Abandoned</option>
                </select>
                <p className="text-muted-foreground text-xs">
                  User-reported; not test results or independently verified quality.
                </p>
                {!data.outcome_available && (
                  <p className="text-sm">Outcome storage is unavailable on this deployment.</p>
                )}
                {mutation.isError && (
                  <p role="alert">Could not save your outcome. Your previous value is unchanged.</p>
                )}
              </section>
              <section aria-label="Operation evidence">
                <h3 className="font-medium">Operation evidence ({data.evidence_count})</h3>
                {evidence.isLoading && <p role="status">Loading evidence…</p>}
                {evidence.isError && (
                  <p role="alert">
                    Could not load evidence.{' '}
                    <Button onClick={() => void evidence.refetch()} variant="outline">
                      Reload evidence
                    </Button>
                  </p>
                )}
                <ul className="mt-2 space-y-2">
                  {evidence.data?.pages
                    .flatMap((page) => page.operations)
                    .map((op) => (
                      <li className="rounded-md border p-2 text-sm" key={op.event_id}>
                        <p>
                          {new Date(op.occurred_at * 1000).toLocaleString()} · {op.actor}
                        </p>
                        <p>
                          {op.lines_added == null ? 'Additions unavailable' : `+${op.lines_added}`}{' '}
                          /{' '}
                          {op.lines_deleted == null
                            ? 'deletions unavailable'
                            : `−${op.lines_deleted}`}{' '}
                          · revision {op.revision}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {op.identity_source ?? 'Source unavailable'} ·{' '}
                          {op.identity_reason ?? 'No identity reason reported'}
                        </p>
                      </li>
                    ))}
                </ul>
                {data.evidence_count === 0 && (
                  <p className="text-sm">No exact session operations are available.</p>
                )}
                {evidence.hasNextPage && (
                  <Button
                    disabled={evidence.isFetchingNextPage}
                    onClick={() => void evidence.fetchNextPage()}
                    variant="outline"
                  >
                    More evidence
                  </Button>
                )}
                <Link
                  className="mt-2 block text-sm underline"
                  href="/dashboard/wakaclock/analytics/trust"
                >
                  Open Trust Center and correction history
                </Link>
              </section>
              <p className="text-muted-foreground text-xs">
                Snapshot: {new Date(data.generated_at).toLocaleString()} · Maximum ingestion lag:{' '}
                {data.diagnostics.max_ingestion_lag_seconds ?? 'unavailable'} seconds.
              </p>
              <Button onClick={() => download(data)} variant="outline">
                Download metadata receipt
              </Button>
              <p className="text-muted-foreground text-xs">
                Exports this summary snapshot and up to 100 evidence references. Full evidence is
                paginated above.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
