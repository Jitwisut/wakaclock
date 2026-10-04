import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkSessionReceiptDrawer } from '@/components/wakaclock/work-session-receipt';
import {
  getSessionEvidence,
  getWorkSession,
  measuredLabel,
  receiptExport,
  sessionKeys,
  setSessionOutcome,
} from '@/lib/wakaclock/work-sessions';

import { receiptFixture } from './fixtures/work-session';

vi.mock('@/lib/wakaclock/work-sessions', async (original) => ({
  ...(await original<object>()),
  getWorkSession: vi.fn(),
  getSessionEvidence: vi.fn(),
  setSessionOutcome: vi.fn(),
}));
function renderReceipt() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const view = (id = receiptFixture.id, userId = 'user-a') => (
    <QueryClientProvider client={client}>
      <WorkSessionReceiptDrawer id={id} key={`${userId}:${id}`} onClose={onClose} userId={userId} />
    </QueryClientProvider>
  );
  return { ...render(view()), client, onClose, view };
}
beforeEach(() => {
  vi.mocked(getWorkSession).mockResolvedValue(structuredClone(receiptFixture));
  vi.mocked(getSessionEvidence).mockResolvedValue({
    operations: [],
    has_more: false,
    next_cursor: null,
    date_basis: 'whole_native_session',
  });
  vi.mocked(setSessionOutcome).mockResolvedValue(undefined);
});
describe('work session receipt', () => {
  it('keeps loading visible, retries a failed read, and closes with Escape', async () => {
    let finish!: (value: typeof receiptFixture) => void;
    vi.mocked(getWorkSession)
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      );
    const view = renderReceipt();
    expect(screen.getByRole('status')).toHaveTextContent('Loading receipt');
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(getWorkSession).toHaveBeenCalledTimes(2));
    await act(async () => finish(structuredClone(receiptFixture)));
    expect(await screen.findByText('codex · experimental')).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(view.onClose).toHaveBeenCalled();
  });

  it('retains and labels a stale snapshot after background refetch fails', async () => {
    const view = renderReceipt();
    await screen.findByText('codex · experimental');
    vi.mocked(getWorkSession).mockRejectedValue(new Error('offline'));
    await act(async () => {
      await view.client.invalidateQueries({
        queryKey: sessionKeys.detail('user-a', receiptFixture.id),
      });
    });
    expect(await screen.findByText(/Showing the last loaded snapshot/)).toBeVisible();
    expect(screen.getByText('Reported usage')).toBeVisible();
  });

  it('loads all evidence pages and removes old evidence when the revision changes', async () => {
    const op = {
      event_id: 'old-operation',
      occurred_at: 1,
      actor: 'verified',
      agent: 'codex',
      model: null,
      provider: null,
      repair_reference: 'opaque-repair',
      lines_added: 2,
      lines_deleted: 0,
      revision: 1,
      identity_source: 'agent_hook',
      identity_reason: 'confirmed',
    };
    const page = {
      operations: [op],
      next_cursor: 'next',
      has_more: true,
      date_basis: 'whole_native_session',
    } as Awaited<ReturnType<typeof getSessionEvidence>>;
    vi.mocked(getWorkSession).mockResolvedValue({
      ...structuredClone(receiptFixture),
      evidence_count: 2,
    });
    vi.mocked(getSessionEvidence)
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce({
        ...page,
        operations: [
          {
            ...op,
            event_id: 'second-operation',
            lines_added: null,
            lines_deleted: null,
            identity_source: null,
            identity_reason: null,
          },
        ],
        next_cursor: null,
        has_more: false,
      });
    const view = renderReceipt();
    fireEvent.click(await screen.findByRole('button', { name: 'More evidence' }));
    expect(await screen.findByText(/Additions unavailable/)).toBeVisible();
    expect(screen.getByText(/Source unavailable/)).toBeVisible();
    expect(getSessionEvidence).toHaveBeenLastCalledWith(receiptFixture.id, 'next');
    let finish!: (value: typeof page) => void;
    vi.mocked(getSessionEvidence).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await act(async () => {
      view.client.setQueryData(sessionKeys.detail('user-a', receiptFixture.id), {
        ...receiptFixture,
        evidence_count: 1,
        revision_fingerprint: 'new',
      });
    });
    expect(await screen.findByText('Loading evidence…')).toBeVisible();
    expect(screen.queryAllByText(/revision 1/)).toHaveLength(0);
    await act(async () =>
      finish({ ...page, operations: [{ ...op, revision: 2 }], next_cursor: null, has_more: false })
    );
    expect(await screen.findByText(/revision 2/)).toBeVisible();
    expect(screen.queryByText(/revision 1/)).not.toBeInTheDocument();
  });

  it('recovers failed evidence independently of the receipt', async () => {
    vi.mocked(getSessionEvidence)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({
        operations: [],
        has_more: false,
        next_cursor: null,
        date_basis: 'whole_native_session',
      });
    renderReceipt();
    fireEvent.click(await screen.findByRole('button', { name: 'Reload evidence' }));
    await waitFor(() =>
      expect(screen.queryByText('Could not load evidence.')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Reported usage')).toBeVisible();
  });

  it('explains unresolved identity and disables unavailable outcome storage', async () => {
    const value = structuredClone(receiptFixture);
    value.identity_status = 'legacy_unresolved';
    value.outcome_available = false;
    value.lines.reason = null;
    value.diagnostics.max_ingestion_lag_seconds = null;
    value.usage.pricing_versions = ['pricing-v1'];
    value.project_ids = ['missing'];
    vi.mocked(getWorkSession).mockResolvedValue(value);
    renderReceipt();
    expect(await screen.findByLabelText('Your outcome')).toBeDisabled();
    expect(screen.getByText(/Collector or session scope is unresolved/)).toBeVisible();
    expect(screen.getByText(/Outcome storage is unavailable/)).toBeVisible();
    expect(screen.getByText(/Pricing: pricing-v1/)).toBeVisible();
    expect(screen.getByText(/Project name unavailable/)).toBeVisible();
  });

  it('refreshes each saved outcome and downloads the annotated snapshot', async () => {
    const value = structuredClone(receiptFixture);
    vi.mocked(getWorkSession).mockImplementation(async () => structuredClone(value));
    let finish!: () => void;
    vi.mocked(setSessionOutcome).mockImplementation(async (_id, outcome) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      value.outcome = {
        value: outcome,
        version: (value.outcome?.version ?? 0) + 1,
        updated_at: value.generated_at,
      };
      value.revision_fingerprint = `annotation-${value.outcome.version}`;
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderReceipt();
    const select = await screen.findByLabelText('Your outcome');
    for (const outcome of ['completed', 'needs_work', 'abandoned']) {
      fireEvent.change(select, { target: { value: outcome } });
      await waitFor(() => expect(select).toBeDisabled());
      await act(async () => finish());
      await waitFor(() => expect(select).toHaveValue(outcome));
      expect(select).toBeEnabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Download metadata receipt' }));
    expect(click).toHaveBeenCalledOnce();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    let text = '';
    await act(async () => {
      text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blob);
      });
    });
    expect(JSON.parse(text)).toMatchObject({
      outcome: value.outcome,
      revision_fingerprint: value.revision_fingerprint,
      usage: value.usage,
    });
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url'));
  });

  it('clears the previous session immediately when switching session or owner', async () => {
    const view = renderReceipt();
    await screen.findByText('codex · experimental');
    vi.mocked(getWorkSession).mockReturnValue(new Promise(() => {}));
    view.rerender(view.view('another-session'));
    expect(screen.queryByText('codex · experimental')).not.toBeInTheDocument();
    expect(screen.getByText('Loading receipt…')).toBeVisible();
    view.rerender(view.view(receiptFixture.id, 'user-b'));
    expect(screen.queryByText('codex · experimental')).not.toBeInTheDocument();
  });
  it('keeps missing data distinct from measured zero and isolates query caches', () => {
    expect(measuredLabel(receiptFixture.usage.input_tokens)).toBe('0');
    expect(measuredLabel(receiptFixture.usage.output_tokens)).toBe('Not available');
    expect(sessionKeys.detail('a', 'same')).not.toEqual(sessionKeys.detail('b', 'same'));
    expect(sessionKeys.evidence('a', 'same', 'v1')).not.toEqual(
      sessionKeys.evidence('a', 'same', 'v2')
    );
  });
  it('exports a snapshot with nulls, versions and no surplus private fields', () => {
    const value = structuredClone(receiptFixture);
    Object.assign(value, { prompt: 'TOP_SECRET', path: '/private/secret.rs' });
    Object.assign(value.usage, { source: 'TOP_SECRET' });
    Object.assign(value.time, { raw_output: 'TOP_SECRET' });
    value.projects = [{ id: 'project-a', name: '/private/project-name' }];
    Object.assign(value.usage.input_tokens.coverage, { prompt: 'TOP_SECRET' });
    const exported = receiptExport(value);
    expect(exported).not.toContain('TOP_SECRET');
    expect(exported).not.toContain('/private/');
    expect(JSON.parse(exported)).toMatchObject({
      usage: { output_tokens: { value: null } },
      revision_fingerprint: value.revision_fingerprint,
    });
  });
  it('shows partial coverage and explains contextual human time', async () => {
    renderReceipt();
    expect(await screen.findByText('codex · experimental')).toBeInTheDocument();
    expect(screen.getByText(/partial · 1\/2 received records/)).toBeInTheDocument();
    expect(screen.getByText(/does not prove work on this task/)).toBeInTheDocument();
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(3);
    expect(screen.getByText(/No exact session operations/)).toBeInTheDocument();
  });
  it('shows resolved project names and makes missing names explicit', async () => {
    vi.mocked(getWorkSession).mockResolvedValue({
      ...structuredClone(receiptFixture),
      project_ids: ['project-a', 'project-b'],
      projects: [{ id: 'project-a', name: 'My project' }],
    });
    renderReceipt();
    expect(await screen.findByText('My project')).toBeInTheDocument();
    expect(screen.getByText('Project name unavailable (project-b)')).toBeInTheDocument();
  });
  it('writes and withdraws only enumerated user outcomes', async () => {
    renderReceipt();
    const select = await screen.findByLabelText('Your outcome');
    fireEvent.change(select, { target: { value: 'completed' } });
    await waitFor(() =>
      expect(setSessionOutcome).toHaveBeenCalledWith(receiptFixture.id, 'completed')
    );
    await waitFor(() => expect(select).not.toBeDisabled());
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(setSessionOutcome).toHaveBeenCalledWith(receiptFixture.id, null));
  });
  it('shows read failure without making up a zero-value receipt', async () => {
    vi.mocked(getWorkSession).mockRejectedValue(new Error('offline'));
    renderReceipt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this receipt');
    expect(screen.queryByText('Reported usage')).not.toBeInTheDocument();
  });
  it('preserves the displayed outcome after a rejected write', async () => {
    vi.mocked(setSessionOutcome).mockRejectedValue(new Error('scope required'));
    renderReceipt();
    const select = await screen.findByLabelText('Your outcome');
    fireEvent.change(select, { target: { value: 'abandoned' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your outcome');
    expect(select).toHaveValue('');
  });
});
