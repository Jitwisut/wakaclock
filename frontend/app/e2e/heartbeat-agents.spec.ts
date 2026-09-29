import { expect, test } from '@playwright/test';

test('Codex remains visible separately from VS Code in Heartbeats', async ({ page }) => {
  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem(
      'wakaclock-session',
      JSON.stringify({
        userId: 'heartbeat-fixture',
        username: 'Fixture',
        token: `test.${payload}.test`,
      })
    );
  });
  const base = {
    time: Math.floor(Date.now() / 1000),
    entity_type: 'file',
    category: 'coding',
    project: 'fixture',
    editor: 'vscode',
    operating_system: 'darwin',
    machine: 'fixture',
    language: 'TypeScript',
    dependencies: [],
    is_write: true,
    active_seconds: null,
    branch: null,
    line_number: null,
    cursor_position: null,
    lines: null,
    ast_language: null,
    ast_confidence: null,
  };
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let body: unknown = { data: {} };
    if (pathname.endsWith('/heartbeats'))
      body = {
        total: 2,
        data: [
          {
            ...base,
            entity: '/fixture/codex-file.ts',
            actor_type: 'ai_verified',
            ai_agent: 'codex',
          },
          { ...base, entity: '/fixture/editor-file.ts', actor_type: 'unknown', ai_agent: null },
        ],
      };
    if (pathname.endsWith('/capabilities')) body = { data: { features: [] } };
    await route.fulfill({ json: body });
  });
  await page.goto('/dashboard/wakaclock/heartbeats');
  await page.getByRole('tab', { name: 'AI agents' }).click();
  await page.getByRole('button', { name: /codex.*100%/ }).click();
  await expect(page.getByText('1 of 2 heartbeats match')).toBeVisible();
  await expect(page.getByText('codex-file.ts', { exact: true })).toBeVisible();
  await expect(page.getByText('editor-file.ts', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('searchbox', { name: /editor or agent/ }).fill('codex');
  await expect(page.getByText('1 of 2 heartbeats match')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const row = page
    .getByRole('button')
    .filter({ has: page.getByText('codex-file.ts', { exact: true }) });
  await expect(row.getByText('codex', { exact: true })).toBeVisible();
  await row.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('codex', { exact: true })).toBeVisible();
  await expect(dialog.getByText('VS Code', { exact: true })).toBeVisible();
});
