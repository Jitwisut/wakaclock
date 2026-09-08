"use strict";
// planai2.md Phase 7 (p7.2) — the "AtoAxis: Test AI Detection" diagnostic.
//
// A pure, dependency-injected self-test that composes the local broker status
// and the AI-adapter status into a single pass/degraded/failing report. The
// VS Code command is a thin wrapper around `runAiDetectionSelfTest`; the logic
// lives here so it can be tested without the extension host.
Object.defineProperty(exports, "__esModule", { value: true });
exports.STALE_EVIDENCE_MS = void 0;
exports.runAiDetectionSelfTest = runAiDetectionSelfTest;
exports.formatAiDetectionReport = formatAiDetectionReport;
/** Evidence older than this (or never received) is a soft warning, not a failure. */
exports.STALE_EVIDENCE_MS = 24 * 60 * 60 * 1000;
function rollUp(checks) {
    if (checks.some((c) => c.severity === 'fail')) {
        return 'failing';
    }
    if (checks.some((c) => c.severity === 'warn')) {
        return 'degraded';
    }
    return 'ok';
}
async function runAiDetectionSelfTest(deps) {
    const now = deps.now ?? (() => Date.now());
    const checks = [];
    if (deps.getDiagnosticsSnapshot) {
        try {
            const snapshot = await deps.getDiagnosticsSnapshot();
            const runtimeHealth = snapshot.runtime_health;
            checks.push({
                id: 'diagnostics-runtime',
                label: 'AI diagnostics collector runtime',
                severity: runtimeHealth === 'healthy' || runtimeHealth === 'idle'
                    ? 'ok'
                    : runtimeHealth === 'disabled'
                        ? 'warn'
                        : runtimeHealth === 'degraded'
                            ? 'warn'
                            : 'fail',
                detail: runtimeHealth,
            });
            const brokerRunning = snapshot.broker.running;
            checks.push({
                id: 'broker-running',
                label: 'Local AI broker running',
                severity: brokerRunning.availability !== 'available'
                    ? 'warn'
                    : brokerRunning.value === true
                        ? 'ok'
                        : 'fail',
                detail: brokerRunning.availability !== 'available'
                    ? 'broker running probe unavailable'
                    : brokerRunning.value === true
                        ? undefined
                        : 'run "AtoAxis: Repair AI Integrations"',
            });
            const deadLetter = snapshot.broker.dead_letter;
            checks.push({
                id: 'broker-inbox-draining',
                label: 'Broker inbox draining',
                severity: deadLetter.availability !== 'available'
                    ? 'warn'
                    : (deadLetter.value ?? 0) > 0
                        ? 'warn'
                        : 'ok',
                detail: deadLetter.availability !== 'available'
                    ? 'dead-letter probe unavailable'
                    : (deadLetter.value ?? 0) > 0
                        ? `${deadLetter.value} event(s) in dead-letter`
                        : undefined,
            });
            const detected = snapshot.adapters.filter((adapter) => adapter.detected.availability === 'available' && adapter.detected.value === true);
            checks.push({
                id: 'adapters-detected',
                label: 'AI agents detected on this machine',
                severity: detected.length > 0 ? 'ok' : 'warn',
                detail: detected.length > 0
                    ? detected.map((adapter) => adapter.agent).join(', ')
                    : 'no supported AI agent found (Claude Code, Codex, Gemini CLI, …)',
            });
            const disabled = snapshot.adapters.filter((adapter) => adapter.enabled.availability === 'available' && adapter.enabled.value === false);
            if (disabled.length > 0) {
                checks.push({
                    id: 'adapters-enabled',
                    label: 'Detected agents have AI tracking enabled',
                    severity: 'warn',
                    detail: `not enabled: ${disabled.map((adapter) => adapter.agent).join(', ')}`,
                });
            }
            return { verdict: rollUp(checks), checks };
        }
        catch (error) {
            checks.push({
                id: 'diagnostics-collector',
                label: 'AI diagnostics collector reachable',
                severity: 'warn',
                detail: error instanceof Error ? error.message : 'diagnostics snapshot unavailable',
            });
        }
    }
    let broker;
    try {
        broker = await deps.getBrokerStatus();
    }
    catch (error) {
        checks.push({
            id: 'broker-reachable',
            label: 'Local AI broker reachable',
            severity: 'fail',
            detail: error instanceof Error ? error.message : 'broker status unavailable',
        });
    }
    if (broker) {
        checks.push({
            id: 'broker-running',
            label: 'Local AI broker running',
            severity: broker.running === true ? 'ok' : 'fail',
            detail: broker.running === true ? undefined : 'run "AtoAxis: Repair AI Integrations"',
        });
        const deadLetter = broker.inbox?.dead_letter ?? 0;
        checks.push({
            id: 'broker-inbox-draining',
            label: 'Broker inbox draining',
            severity: deadLetter > 0 ? 'warn' : 'ok',
            detail: deadLetter > 0 ? `${deadLetter} event(s) in dead-letter` : undefined,
        });
        const lastError = broker.inbox?.last_error_message;
        if (lastError) {
            checks.push({
                id: 'broker-last-delivery',
                label: 'Last delivery attempt',
                severity: 'warn',
                detail: lastError,
            });
        }
        const lastReceived = broker.last_received_at ?? broker.inbox?.last_received_at ?? null;
        const ageMs = lastReceived == null ? null : now() - lastReceived * 1000;
        checks.push({
            id: 'recent-evidence',
            label: 'Recent AI evidence received',
            severity: ageMs != null && ageMs <= exports.STALE_EVIDENCE_MS ? 'ok' : 'warn',
            detail: ageMs == null
                ? 'no evidence received yet — edit a file with an AI agent to generate some'
                : ageMs <= exports.STALE_EVIDENCE_MS
                    ? undefined
                    : `last evidence ${Math.round(ageMs / 3_600_000)}h ago`,
        });
    }
    let agents = [];
    try {
        agents = await deps.getAiAgentStatuses();
    }
    catch (error) {
        checks.push({
            id: 'adapters-listed',
            label: 'AI adapters enumerable',
            severity: 'warn',
            detail: error instanceof Error ? error.message : 'adapter status unavailable',
        });
    }
    const detected = agents.filter((a) => a.detected);
    checks.push({
        id: 'adapters-detected',
        label: 'AI agents detected on this machine',
        severity: detected.length > 0 ? 'ok' : 'warn',
        detail: detected.length > 0
            ? detected.map((a) => a.label).join(', ')
            : 'no supported AI agent found (Claude Code, Codex, Gemini CLI, …)',
    });
    const detectedNotEnabled = detected.filter((a) => !a.enabled);
    if (detectedNotEnabled.length > 0) {
        checks.push({
            id: 'adapters-enabled',
            label: 'Detected agents have AI tracking enabled',
            severity: 'warn',
            detail: `not enabled: ${detectedNotEnabled.map((a) => a.label).join(', ')}`,
        });
    }
    return { verdict: rollUp(checks), checks };
}
/** A one-line-per-check summary suitable for a notification body. */
function formatAiDetectionReport(report) {
    const mark = { ok: '✓', warn: '!', fail: '✗' };
    const header = report.verdict === 'ok'
        ? 'AI detection looks healthy.'
        : report.verdict === 'degraded'
            ? 'AI detection is working with warnings.'
            : 'AI detection is not working.';
    const lines = report.checks.map((c) => `${mark[c.severity]} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
    return [header, ...lines].join('\n');
}
//# sourceMappingURL=aiDetectionSelfTest.js.map