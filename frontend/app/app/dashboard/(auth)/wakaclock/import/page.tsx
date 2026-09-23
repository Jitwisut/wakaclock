'use client';

import * as React from 'react';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';
import { RequiresPostgres } from '@/components/wakaclock/requires-postgres';
import { env } from '@/lib/env';
import { WakaclockError } from '@/lib/wakaclock/client';
import { getProjects, getStatusBar } from '@/lib/wakaclock/endpoints';
import {
  completeWakaTimeImport,
  getWakaTimeImport,
  startWakaTimeImport,
  uploadWakaTimeImportChunk,
} from '@/lib/wakaclock/endpoints-v2';
import { formatDurationShort, todayDateString } from '@/lib/wakaclock/format';
import type { WakaTimeImportJob } from '@/lib/wakaclock/measurement-types';
import type { ProjectsResponse, StatusBarResponse } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';
import { splitWakaTimeExport } from '@/lib/wakaclock/wakatime-import-chunks';

async function digestText(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function WakaTimeImportPage() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const [file, setFile] = React.useState<File | null>(null);
  const [job, setJob] = React.useState<null | WakaTimeImportJob>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<null | string>(null);
  const [checking, setChecking] = React.useState(false);
  const [connection, setConnection] = React.useState<{
    checkedAt: number;
    projects: ProjectsResponse;
    status: StatusBarResponse;
  } | null>(null);
  const [connectionError, setConnectionError] = React.useState<null | string>(null);

  const checkConnection = async () => {
    if (!userId) return;
    setChecking(true);
    setConnectionError(null);
    try {
      const today = todayDateString();
      const [status, projects] = await Promise.all([
        getStatusBar(),
        getProjects(userId, today, today),
      ]);
      setConnection({ checkedAt: Date.now(), status, projects });
    } catch (error_) {
      setConnectionError(error_ instanceof Error ? error_.message : 'Connection check failed.');
    } finally {
      setChecking(false);
    }
  };

  const importFile = async () => {
    if (!file || !userId) return;
    setBusy(true);
    setError(null);
    try {
      const raw = await file.text();
      const chunks = splitWakaTimeExport(raw);
      const digest = await digestText(raw);
      const storageKey = `atoaxis:wakatime-import:${userId}:${digest}`;
      let importId = window.localStorage.getItem(storageKey);
      let current: null | WakaTimeImportJob = null;
      if (importId) {
        try {
          current = await getWakaTimeImport(importId);
        } catch (error_) {
          if (!(error_ instanceof WakaclockError) || !error_.isNotFound) throw error_;
        }
      }
      if (!current || current.total_chunks !== chunks.length) {
        importId = crypto.randomUUID();
        current = await startWakaTimeImport(importId, chunks.length);
        window.localStorage.setItem(storageKey, importId);
      }
      setJob(current);
      if (!current.completed) {
        const activeImportId = current.id;
        const received = new Set(current.received_chunks);
        for (let index = 0; index < chunks.length; index += 1) {
          if (received.has(index)) continue;
          current = await uploadWakaTimeImportChunk(activeImportId, index, chunks[index]);
          setJob(current);
        }
        current = await completeWakaTimeImport(activeImportId);
        setJob(current);
      }
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : 'Import failed. Select the same file to resume.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <WakaclockPageHeader
        description="Bring your raw WakaTime heartbeat history into AtoAxis. Re-select the same file after an interruption to resume."
        title="Import WakaTime history"
      />
      <RequireUser>
        <Card>
          <CardHeader>
            <CardTitle>Connect an existing WakaTime editor plugin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Keep the plugin installed. Open its <code>.wakatime.cfg</code> settings, set the API
              URL below, and use an AtoAxis key from{' '}
              <Link className="underline" href="/dashboard/wakaclock/settings?tab=api-key">
                API key settings
              </Link>
              . Existing WakaTime credentials should stay private.
            </p>
            <pre className="overflow-x-auto rounded-md border p-3">{`[settings]\napi_url = ${env.NEXT_PUBLIC_WAKACLOCK_API_URL}/api/v1\napi_key = <your AtoAxis API key>`}</pre>
            <p>
              Save the config, edit a file in your project, then check delivery. Some plugins cache
              settings until the editor restarts. This confirms time data only; AI/model identity
              depends on a separately certified integration.
            </p>
            <Button disabled={checking} onClick={checkConnection} variant="outline">
              {checking ? 'Checking…' : 'Check heartbeat and project'}
            </Button>
            {connectionError && <p role="alert">{connectionError}</p>}
            {connection && (
              <div aria-live="polite" className="rounded-md border p-3">
                <p>Today’s heartbeats: {connection.status.heartbeat_count}</p>
                <p>
                  Latest heartbeat:{' '}
                  {connection.status.last_heartbeat_at
                    ? new Date(connection.status.last_heartbeat_at * 1000).toLocaleString()
                    : 'unavailable'}
                </p>
                <p>
                  Projects today:{' '}
                  {connection.projects.data.length > 0
                    ? connection.projects.data.map((project) => project.name).join(', ')
                    : 'none yet'}
                </p>
                <p className="text-muted-foreground">
                  Checked at {new Date(connection.checkedAt).toLocaleTimeString()}. If the latest
                  heartbeat predates your test edit, inspect the plugin log and try again.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <RequiresPostgres feature="Resumable import">
          <Card>
            <CardHeader>
              <CardTitle>Choose your export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Choose a JSON data dump containing raw heartbeats. Summary-only exports cannot
                reconstruct your history. The browser removes unrelated fields before upload and
                stores only a file fingerprint and job ID for resume.
              </p>
              <input
                accept=".json,application/json"
                aria-label="WakaTime JSON export"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <div>
                <Button disabled={!file || busy} onClick={importFile}>
                  {busy ? 'Importing…' : 'Import history'}
                </Button>
              </div>
              {error && <p role="alert">{error} You can retry with the same file.</p>}
              {job && (
                <div aria-live="polite" className="rounded-md border p-3">
                  <p>
                    {job.completed ? 'Import complete' : 'Import in progress'}:{' '}
                    {job.received_chunks.length} / {job.total_chunks} chunks
                  </p>
                  <p>Imported heartbeats: {job.imported_heartbeats}</p>
                  <p>Skipped or invalid heartbeats: {job.skipped_heartbeats}</p>
                  <p>All-time reported total before: {formatDurationShort(job.before_total_seconds)}</p>
                  <p>
                    All-time reported total after:{' '}
                    {job.after_total_seconds == null
                      ? 'available when all chunks complete'
                      : formatDurationShort(job.after_total_seconds)}
                  </p>
                  {job.net_change_seconds != null && (
                    <p>
                      Observed net change: {job.net_change_seconds < 0 ? '-' : '+'}
                      {formatDurationShort(Math.abs(job.net_change_seconds))}
                    </p>
                  )}
                  {job.after_calculation_version &&
                    job.before_calculation_version !== job.after_calculation_version && (
                      <p role="alert">
                        Calculation version changed during import; compare totals using one
                        version before attributing the difference to this job.
                      </p>
                    )}
                  <p className="text-muted-foreground">
                    Totals cover all account activity in UTC. Other activity during the import may
                    also affect the net change.
                  </p>
                  {Object.entries(job.issue_counts).length > 0 && (
                    <ul className="mt-2 list-inside list-disc">
                      {Object.entries(job.issue_counts).map(([reason, count]) => (
                        <li key={reason}>
                          {reason.replaceAll('_', ' ')}: {count}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </RequiresPostgres>
      </RequireUser>
    </div>
  );
}
