'use client';
import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import * as github from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function CopilotDailyPanel({
  organizationId,
  connection,
}: {
  connection: github.GithubConnection;
  organizationId: string;
}) {
  const user = useWakaclockUserStore((s) => s.userId) ?? '';
  const status = connection.copilot_daily;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const [day, setDay] = React.useState(yesterday);
  const [installation, setInstallation] = React.useState('');
  const cache = useQueryClient();
  const scope = `${user}:${organizationId}`;
  const captured = React.useRef(scope);
  captured.current = scope;
  const daily = useQuery({
    queryKey: wakaclockKeys.copilotSelfDay(user, organizationId, day),
    queryFn: () => github.getCopilotSelfDay(organizationId, day),
    enabled: Boolean(user && status?.configuration?.enabled && status.status !== 'disabled' && day),
    retry: false,
    gcTime: 0,
    refetchInterval: 30_000,
  });
  const update = useMutation({
    mutationFn: async (enabled: boolean) => {
      const prior = scope;
      await github.configureCopilotDaily(organizationId, {
        installation_id: Number(installation || status?.configuration?.installation_id),
        start_day: day,
        enabled,
        expected_revision: status?.configuration?.revision ?? 0,
      });
      if (prior === captured.current) {
        await cache.invalidateQueries({ queryKey: wakaclockKeys.teamGithub(user, organizationId) });
      }
    },
  });

  if (!status) return null;
  const visible =
    daily.isError || !status.configuration?.enabled || status.status === 'disabled'
      ? undefined
      : daily.data;
  return (
    <section aria-label="Copilot daily counters" className="space-y-2 rounded border p-3">
      <h4>Copilot daily counters</h4>
      <p>
        Status: {status.status} · {status.error_code ?? 'No observed error'} · Updated:{' '}
        {status.last_success_at ?? 'unconfirmed'}
      </p>
      <p>
        Provider UTC days and feature definitions. Daily counters have no session/PR attribution.
        Tokens, model and cost: unavailable.
      </p>
      <label>
        Provider day (UTC)
        <input
          aria-label="Copilot provider day"
          max={yesterday}
          onChange={(e) => setDay(e.target.value)}
          type="date"
          value={day}
        />
      </label>
      {connection.can_manage && status.status !== 'disabled' && (
        <div>
          <label>
            Verified organization installation ID
            <input
              aria-label="Copilot installation ID"
              min="1"
              onChange={(e) => setInstallation(e.target.value)}
              type="number"
              value={installation || status.configuration?.installation_id || ''}
            />
          </label>
          <Button
            disabled={
              update.isPending ||
              !day ||
              !Number(installation || status.configuration?.installation_id)
            }
            onClick={() => update.mutate(true)}
          >
            Enable / resync daily reports
          </Button>
          <Button
            disabled={update.isPending || !status.configuration}
            onClick={() => update.mutate(false)}
          >
            Pause daily connector
          </Button>
          <p>
            Requires existing GitHub organization permissions for Copilot metrics. This action does
            not expand App permissions or enable member consent.
          </p>
        </div>
      )}
      {update.isError && (
        <p role="alert">
          Daily configuration unavailable. Check feature flag, installation permissions and
          revision, then reload.
        </p>
      )}
      {daily.isError && (
        <p role="alert">
          Daily evidence unavailable. Reload after verifying your consent and connection.
        </p>
      )}
      {visible && (
        <>
          <p>Coverage: {visible.coverage}. These are your permitted counters only.</p>
          {visible.features.map((f) => (
            <div key={f.feature}>
              <strong>{f.feature}</strong>
              <dl>
                {Object.entries(f.counters).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value === null ? 'unavailable' : value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
