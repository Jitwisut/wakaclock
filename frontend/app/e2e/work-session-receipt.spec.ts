import { expect, test } from '@playwright/test';

import { receiptFixture } from '../test/fixtures/work-session';

test('receipt deep link, partial evidence, outcome, export and keyboard close', async ({
  page,
}, testInfo) => {
  const receipt = structuredClone(receiptFixture);
  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem(
      'wakaclock-session',
      JSON.stringify({
        userId: 'receipt-test-user',
        username: 'Receipt test',
        token: `test.${payload}.test`,
      })
    );
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const envelope = (data: unknown) => ({
      data,
      meta: {
        generated_at: '2026-09-28T10:00:00Z',
        timezone: 'UTC',
        data_freshness: 'live',
        request_id: 'test',
      },
    });
    let body: unknown = { data: { total_seconds: 0 }, reports: [] };
    if (url.pathname.endsWith('/capabilities'))
      body = envelope({
        features: [{ key: 'work_session_receipts', available: true }],
        line_metric_versions: [],
        postgres_enabled: true,
      });
    else if (url.pathname.endsWith('/outcome')) {
      if (request.method() === 'PUT')
        receipt.outcome = {
          value: request.postDataJSON().outcome,
          version: 1,
          updated_at: receipt.generated_at,
        };
      else receipt.outcome = null;
      await route.fulfill({ status: 204 });
      return;
    } else if (url.pathname.endsWith('/evidence'))
      body = envelope({
        operations: [],
        next_cursor: null,
        has_more: false,
        date_basis: 'whole_native_session',
      });
    else if (url.pathname.endsWith(`/work-sessions/${receipt.id}`)) body = envelope(receipt);
    else if (url.pathname.endsWith('/work-sessions'))
      body = envelope({
        items: [
          {
            id: receipt.id,
            agent: receipt.agent,
            first_observed_at: receipt.observed_window.start,
            last_observed_at: receipt.observed_window.end,
            usage_events: 2,
            identity_status: 'scoped',
          },
        ],
        has_more: false,
        next_cursor: null,
      });
    else if (url.pathname.endsWith('/projects/analytics')) body = { items: [], next_cursor: null };
    else if (url.pathname.endsWith('/effectiveness'))
      body = envelope({
        stats: {
          agents: [],
          daily: [],
          total_heartbeats: 0,
          total_ai_lines_added: 0,
          total_human_lines_added: 0,
        },
        metrics_v2: { ai_line_share: null },
      });
    else if (url.pathname.includes('diagnostics')) body = { reports: [] };
    await route.fulfill({ json: body });
  });
  await page.goto(`/dashboard/wakaclock/ai?session=${receipt.id}`);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('codex · experimental')).toBeVisible();
  await expect(dialog.getByText('partial · 1/2 received records')).toBeVisible();
  await expect(dialog.getByText(/Human context does not prove/)).toBeVisible();
  await dialog.getByLabel('Your outcome').selectOption('completed');
  await expect(dialog.getByLabel('Your outcome')).toHaveValue('completed');
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download metadata receipt' }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString()) as typeof receipt;
  expect(exported.usage.output_tokens.value).toBeNull();
  expect(exported.outcome?.value).toBe('completed');
  expect(exported.calculation_version).toBe('work-session-receipt-v1');
  await dialog.getByLabel('Your outcome').selectOption('');
  await expect(dialog.getByLabel('Your outcome')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page).not.toHaveURL(/session=/);
  await page.getByRole('button', { name: /codex.*received usage events/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = await page.getByRole('dialog').boundingBox();
      return Boolean(
        bounds && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize()!.width + 1
      );
    })
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('receipt.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const bounds = await page.getByRole('dialog').boundingBox();
      return Boolean(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391);
    })
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('receipt-mobile.png') });
});
