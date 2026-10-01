const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../.local/receipt-validation');
const { chromium, expect } = require(path.resolve(__dirname, '../../frontend/app/node_modules/@playwright/test'));
function preflight() {
  const result = spawnSync('python3', [path.join(__dirname, 'local_lab.py'), 'readiness'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('lab_preflight_failed');
  return JSON.parse(result.stdout).build_manifest_sha256;
}

(async () => {
  if (process.argv[2] && !/^[a-z0-9-]+\.json$/.test(process.argv[2])) throw new Error('invalid_report_name');
  const build = preflight();
  const account = JSON.parse(fs.readFileSync(path.join(root, 'campaign-account.json')));
  const campaign = JSON.parse(fs.readFileSync(path.join(root, 'evidence/' + (process.argv[2] || 'codex-campaign-final.json'))));
  const row = campaign.scenarios[0];
  if (campaign.build_manifest_sha256 !== build) throw new Error('campaign_build_mismatch');
  if (row.status !== 'passed') throw new Error('native_smoke_required');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const stages = {};
  const snapshots = {};
  try {
    for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(auth => localStorage.setItem('wakaclock-session', JSON.stringify(auth)), {
        userId: account.user_id, username: account.username, token: account.token,
      });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:13000/dashboard/wakaclock/ai?session=' + row.receipt_id);
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText(campaign.agent + ' · experimental')).toBeVisible();
      await expect(dialog.getByRole('heading', { name: 'Operation evidence (1)' })).toBeVisible();
      await expect(dialog.getByText(/revision 0/)).toBeVisible();
      await expect(dialog.getByText(/transcript.*No identity reason reported/)).toBeVisible();
      const outcome = dialog.getByLabel('Your outcome');
      await outcome.selectOption('needs_work');
      await expect(outcome).toBeEnabled();
      await expect(outcome).toHaveValue('needs_work');
      const annotated = await context.request.get('http://127.0.0.1:18080/api/v2/me/work-sessions/' + row.receipt_id, {
        headers: { Authorization: 'Bearer ' + account.api_key },
      });
      const snapshot = (await annotated.json()).data;
      const downloaded = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Download metadata receipt' }).click();
      const stream = await (await downloaded).createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const text = Buffer.concat(chunks).toString();
      const exported = JSON.parse(text);
      expect(exported.id).toBe(row.receipt_id);
      expect(exported.revision_fingerprint).toBe(snapshot.revision_fingerprint);
      expect(exported.evidence_references).toHaveLength(1);
      expect(exported.outcome.value).toBe('needs_work');
      snapshots[name] = exported.revision_fingerprint;
      for (const secret of [account.api_key, account.token, '/Users/', 'ws1_']) expect(text.includes(secret)).toBe(false);
      await outcome.selectOption('');
      await expect(outcome).toBeEnabled();
      await expect(outcome).toHaveValue('');
      await dialog.getByRole('link', { name: 'Open Trust Center and correction history' }).click();
      await expect(page).toHaveURL(/analytics\/trust/);
      stages[name] = 'passed';
      await context.close();
    }
  } finally { await browser.close(); }
  const report = {
    schema_version: 3, build_manifest_sha256: campaign.build_manifest_sha256,
    script_sha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    status: 'passed', evidence_kind: 'validation_run', runner: 'native_browser', runner_sha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), sample_count: 2, mismatches: [], blockers: [],
    scenarios: ['desktop', 'mobile', 'outcome_withdrawal', 'export_snapshot_privacy', 'trust_link'].map(scenario => ({ scenario, status: 'passed', mismatches: [] })), stages,
    receipt_id: row.receipt_id, campaign_revision_fingerprint: row.revision_fingerprint,
    snapshot_fingerprints: snapshots,
    scope: ['native_receipt', 'operation_evidence', 'outcome_withdrawal', 'export_snapshot_privacy', 'trust_link', 'desktop_mobile'],
    promotable: false,
  };
  if (preflight() !== build) throw new Error('build_changed_during_browser_check');
  fs.writeFileSync(path.join(root, 'evidence/native-browser.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report));
})().catch(error => {
  fs.writeFileSync(path.join(root, 'native-browser-private-error.log'), error.message, { mode: 0o600 });
  console.error(JSON.stringify({ status: 'failed', mismatch_code: error.name })); process.exit(1);
});
