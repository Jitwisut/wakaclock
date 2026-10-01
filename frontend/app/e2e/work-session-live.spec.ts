import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import type { WorkSessionReceipt } from '../lib/wakaclock/work-sessions';

interface LabAccount {
  api_key: string;
  token: string;
  user_id: string;
  username: string;
}

// Synthetic integration evidence only; never counts as a native or daily session.
test('production receipt with real API, replay, owner isolation, outcome and export', async ({
  page,
  request,
}) => {
  test.skip(process.env.ATOAXIS_RECEIPT_LIVE_TEST !== '1', 'Requires isolated local lab');
  const root = fileURLToPath(new URL('../../../.local/receipt-validation', import.meta.url));
  const account = JSON.parse(
    readFileSync(path.join(root, 'campaign-account.json'), 'utf8')
  ) as LabAccount;
  const other = JSON.parse(
    readFileSync(path.join(root, 'daily-account.json'), 'utf8')
  ) as LabAccount;
  const origin = 'http://127.0.0.1:18080';
  const headers = { Authorization: `Bearer ${account.api_key}` };
  const collector = randomUUID();
  const session = `ws1_${createHash('sha256').update(randomUUID()).digest('hex')}`;
  const id = createHash('sha256')
    .update(`${account.user_id}:5:codex:${collector}:${session}`)
    .digest('hex');
  const usage = {
    usage_event_id: randomUUID(),
    ai_session_id: session,
    collector_id: collector,
    occurred_at: new Date().toISOString(),
    agent: 'codex',
    provider: 'openai',
    model: 'receipt-integration-fixture',
    prompt_count: 1,
    prompt_character_count: null,
    input_tokens: 0,
    output_tokens: null,
    cache_read_tokens: null,
    cache_write_tokens: null,
    token_source: 'transcript',
  };
  for (let i = 0; i < 2; i++) {
    const delivered = await request.post(`${origin}/api/v1/ai/usage`, {
      headers,
      data: [usage],
    });
    expect(delivered.status()).toBe(200);
  }
  const detailUrl = `${origin}/api/v2/me/work-sessions/${id}`;
  const read = async () => {
    const response = await request.get(detailUrl, { headers });
    expect(response.status()).toBe(200);
    return (await response.json()).data as WorkSessionReceipt;
  };
  const receipt = await read();
  expect(receipt.usage_events).toBe(1);
  expect(receipt.usage.input_tokens.value).toBe(0);
  expect(receipt.usage.output_tokens.value).toBeNull();
  expect(receipt.time.agent_execution_seconds).toBeNull();
  expect(receipt.evidence_count).toBe(0);
  const forbidden = await request.get(detailUrl, {
    headers: { Authorization: `Bearer ${other.api_key}` },
  });
  expect(forbidden.status()).toBe(404);

  await page.addInitScript(
    (auth) => {
      localStorage.setItem('wakaclock-session', JSON.stringify(auth));
    },
    { userId: account.user_id, username: account.username, token: account.token }
  );
  await page.goto(`/dashboard/wakaclock/ai?session=${id}`);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('codex · experimental')).toBeVisible();
  await expect(dialog.getByText('No exact session operations are available.')).toBeVisible();
  const outcome = dialog.getByLabel('Your outcome');
  await outcome.selectOption('completed');
  await expect.poll(async () => (await read()).outcome?.value).toBe('completed');
  await expect(outcome).toBeEnabled();
  const annotated = await read();
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download metadata receipt' }).click();
  const stream = await (await downloaded).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString();
  const exported = JSON.parse(text) as WorkSessionReceipt;
  expect(exported.id).toBe(id);
  expect(exported.revision_fingerprint).toBe(annotated.revision_fingerprint);
  expect(exported.usage).toEqual(receipt.usage);
  expect(exported.outcome?.value).toBe('completed');
  for (const secret of [account.api_key, account.token, session, collector, '/Users/']) {
    expect(text.includes(secret)).toBe(false);
  }
  await outcome.selectOption('');
  await expect.poll(async () => (await read()).outcome?.value ?? null).toBeNull();
  await expect(outcome).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('loads more than 25 real evidence rows on desktop and mobile without duplicates', async ({
  page,
  request,
}) => {
  test.skip(process.env.ATOAXIS_RECEIPT_LIVE_TEST !== '1', 'Requires isolated local lab');
  const root = fileURLToPath(new URL('../../../.local/receipt-validation', import.meta.url));
  const account = JSON.parse(
    readFileSync(path.join(root, 'campaign-account.json'), 'utf8')
  ) as LabAccount;
  const origin = 'http://127.0.0.1:18080';
  const headers = { Authorization: `Bearer ${account.api_key}` };
  const collector = randomUUID();
  const session = `ws1_${createHash('sha256').update(randomUUID()).digest('hex')}`;
  const id = createHash('sha256')
    .update(`${account.user_id}:5:codex:${collector}:${session}`)
    .digest('hex');
  const at = Date.now() / 1000;
  const usage = await request.post(`${origin}/api/v1/ai/usage`, {
    headers,
    data: [
      {
        usage_event_id: randomUUID(),
        ai_session_id: session,
        collector_id: collector,
        occurred_at: new Date(at * 1000).toISOString(),
        agent: 'codex',
        provider: 'openai',
        model: 'receipt-pagination-fixture',
        input_tokens: 0,
        token_source: 'transcript',
      },
    ],
  });
  expect(usage.status()).toBe(200);
  for (let index = 0; index < 26; index++) {
    const event = randomUUID();
    const delivered = await request.post(`${origin}/api/v1/users/current/heartbeats`, {
      headers,
      data: {
        entity: `receipt-pagination-${index}.rs`,
        entity_type: 'file',
        time: at,
        heartbeat_id: event,
        ai_event_id: event,
        session_id: session,
        machine: collector,
        is_write: true,
        is_ai_generated: true,
        ai_agent: 'codex',
        ai_provider: 'openai',
        identity_status: 'confirmed',
        identity_source: 'agent_hook',
        ai_source: 'agent_hook',
        ai_confidence: 'verified',
        ai_lines_added: index + 1,
        ai_lines_deleted: 0,
      },
    });
    expect(delivered.status()).toBe(200);
  }
  await page.addInitScript(
    (auth) => localStorage.setItem('wakaclock-session', JSON.stringify(auth)),
    { userId: account.user_id, username: account.username, token: account.token }
  );
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/dashboard/wakaclock/ai?session=${id}`);
    const evidence = page.getByRole('region', { name: 'Operation evidence' });
    await expect(evidence.getByRole('listitem')).toHaveCount(25);
    await evidence.getByRole('button', { name: 'More evidence' }).click();
    await expect(evidence.getByRole('listitem')).toHaveCount(26);
    await expect(evidence.getByRole('button', { name: 'More evidence' })).toHaveCount(0);
    const rows = await evidence.getByRole('listitem').allTextContents();
    expect(new Set(rows).size).toBe(26);
  }
});
