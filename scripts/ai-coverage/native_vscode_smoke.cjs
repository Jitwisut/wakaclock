// Runs inside a REAL native VS Code extension test host. No provider content,
// editing, capture, account login or hook installation is performed by this test.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const vscode = require('vscode');

exports.run = async function () {
  const config = JSON.parse(fs.readFileSync(process.env.NATIVE_SMOKE_TEST_CONFIG, 'utf8'));
  const target = `${process.platform}-${process.arch}`;
  if (target !== config.target) throw new Error('native_vscode_architecture_mismatch');
  const settings = vscode.workspace.getConfiguration('wakaclock');
  if (settings.get('autoInstallAgentHooks') !== false || settings.get('presenceAutoJoinEnabled') !== false) {
    throw new Error('native_vscode_automatic_setup_not_disabled');
  }
  const extension = vscode.extensions.getExtension(config.candidateId);
  if (!extension) throw new Error('native_vscode_candidate_not_installed');
  await extension.activate();
  if (!extension.isActive) throw new Error('native_vscode_activation_unconfirmed');
  const required = ['wakaclock.runtimePause', 'wakaclock.runtimeResume', 'wakaclock.inspectJournal',
    'wakaclock.prepareJournalRecovery', 'wakaclock.applyJournalRecovery', 'wakaclock.journalRecoveryHistory'];
  const commands = new Set(await vscode.commands.getCommands(true));
  if (required.some(command => !commands.has(command))) throw new Error('native_vscode_commands_missing');
  const manifest = JSON.parse(fs.readFileSync(path.join(extension.extensionPath, 'resources', 'cli-manifest.json'), 'utf8'));
  if (manifest.sourceCommit !== config.commit || manifest.target !== target || manifest.sha256 !== config.binarySha256) {
    throw new Error('native_vscode_manifest_mismatch');
  }
  const binary = path.join(extension.extensionPath, 'resources', 'bin', manifest.binary);
  const observed = crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
  if (observed !== config.binarySha256) throw new Error('native_vscode_bundled_binary_mismatch');
  const scope = JSON.parse(cp.execFileSync(binary, ['journal-scope'], { encoding: 'utf8', timeout: 15000 }));
  if (!scope.capabilities?.includes('editor_durable_ack_v1')) throw new Error('native_vscode_bundled_cli_incompatible');
  const custom = path.join(path.dirname(config.resultFile), 'custom-' + path.basename(manifest.binary));
  fs.copyFileSync(binary, custom);
  fs.chmodSync(custom, 0o700);
  const before = fs.statSync(custom, { bigint: true }).mtimeNs;
  await settings.update('cliPath', custom, vscode.ConfigurationTarget.Global);
  await vscode.commands.executeCommand('wakaclock.upgradeManagedCli');
  if (vscode.workspace.getConfiguration('wakaclock').inspect('cliPath')?.globalValue !== custom ||
      crypto.createHash('sha256').update(fs.readFileSync(custom)).digest('hex') !== observed ||
      fs.statSync(custom, { bigint: true }).mtimeNs !== before) {
    throw new Error('native_vscode_custom_override_modified');
  }
  await settings.update('cliPath', '', vscode.ConfigurationTarget.Global);
  fs.writeFileSync(config.resultFile, JSON.stringify({ schema_version: 1, source_commit: config.commit,
    target, binary_sha256: observed, vscode_version: vscode.version, installed: true, activated: true,
    commands_registered: true, bundled_cli_executed: true, custom_override_preserved: true,
    provider_certification: 'pending' }) + '\n');
};
