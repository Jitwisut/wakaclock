"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const aiDetectionSelfTest_1 = require("../src/aiDetectionSelfTest");
// planai2.md p7.2 — "AtoAxis: Test AI Detection" composes broker + adapter
// status into one pass/degraded/failing verdict, without the extension host.
const NOW = 1_700_000_000_000;
function deps(overrides = {}) {
    return {
        now: () => NOW,
        getBrokerStatus: vitest_1.vi.fn().mockResolvedValue({
            running: true,
            last_received_at: Math.floor((NOW - 60_000) / 1000),
            inbox: { pending: 0, retry: 0, dead_letter: 0 },
        }),
        getAiAgentStatuses: vitest_1.vi.fn().mockResolvedValue([
            { id: 'claude-code', label: 'Claude Code', provider: 'anthropic', detected: true, enabled: true },
        ]),
        ...overrides,
    };
}
(0, vitest_1.describe)('runAiDetectionSelfTest', () => {
    (0, vitest_1.it)('reports ok when the broker runs, evidence is fresh and an agent is enabled', async () => {
        const report = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps());
        (0, vitest_1.expect)(report.verdict).toBe('ok');
        (0, vitest_1.expect)(report.checks.every((c) => c.severity === 'ok')).toBe(true);
    });
    (0, vitest_1.it)('fails when the broker is not running', async () => {
        const report = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps({
            getBrokerStatus: vitest_1.vi.fn().mockResolvedValue({ running: false, inbox: { dead_letter: 0 } }),
        }));
        (0, vitest_1.expect)(report.verdict).toBe('failing');
        (0, vitest_1.expect)(report.checks.find((c) => c.id === 'broker-running')?.severity).toBe('fail');
    });
    (0, vitest_1.it)('fails with a broker-reachable check when the status call throws', async () => {
        const report = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps({ getBrokerStatus: vitest_1.vi.fn().mockRejectedValue(new Error('no json on stdout')) }));
        (0, vitest_1.expect)(report.verdict).toBe('failing');
        const check = report.checks.find((c) => c.id === 'broker-reachable');
        (0, vitest_1.expect)(check?.severity).toBe('fail');
        (0, vitest_1.expect)(check?.detail).toContain('no json');
    });
    (0, vitest_1.it)('degrades (not fails) when the broker runs but there is a dead-letter backlog', async () => {
        const report = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps({
            getBrokerStatus: vitest_1.vi.fn().mockResolvedValue({
                running: true,
                last_received_at: Math.floor((NOW - 60_000) / 1000),
                inbox: { dead_letter: 3 },
            }),
        }));
        (0, vitest_1.expect)(report.verdict).toBe('degraded');
        (0, vitest_1.expect)(report.checks.find((c) => c.id === 'broker-inbox-draining')?.detail).toContain('3');
    });
    (0, vitest_1.it)('degrades when evidence is older than the staleness window', async () => {
        const report = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps({
            getBrokerStatus: vitest_1.vi.fn().mockResolvedValue({
                running: true,
                last_received_at: Math.floor((NOW - aiDetectionSelfTest_1.STALE_EVIDENCE_MS - 60_000) / 1000),
                inbox: { dead_letter: 0 },
            }),
        }));
        (0, vitest_1.expect)(report.verdict).toBe('degraded');
        (0, vitest_1.expect)(report.checks.find((c) => c.id === 'recent-evidence')?.severity).toBe('warn');
    });
    (0, vitest_1.it)('degrades when no agent is detected, and when a detected agent is not enabled', async () => {
        const none = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps({ getAiAgentStatuses: vitest_1.vi.fn().mockResolvedValue([]) }));
        (0, vitest_1.expect)(none.verdict).toBe('degraded');
        (0, vitest_1.expect)(none.checks.find((c) => c.id === 'adapters-detected')?.severity).toBe('warn');
        const disabled = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps({
            getAiAgentStatuses: vitest_1.vi.fn().mockResolvedValue([
                { id: 'codex', label: 'Codex', provider: 'openai', detected: true, enabled: false },
            ]),
        }));
        (0, vitest_1.expect)(disabled.checks.find((c) => c.id === 'adapters-enabled')?.detail).toContain('Codex');
    });
    (0, vitest_1.it)('surfaces the last delivery error when present', async () => {
        const report = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps({
            getBrokerStatus: vitest_1.vi.fn().mockResolvedValue({
                running: true,
                last_received_at: Math.floor((NOW - 60_000) / 1000),
                inbox: { dead_letter: 0, last_error_message: 'HTTP 402 payment required' },
            }),
        }));
        (0, vitest_1.expect)(report.checks.find((c) => c.id === 'broker-last-delivery')?.detail).toContain('402');
    });
});
(0, vitest_1.describe)('formatAiDetectionReport', () => {
    (0, vitest_1.it)('renders a header plus one marked line per check', async () => {
        const report = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps());
        const text = (0, aiDetectionSelfTest_1.formatAiDetectionReport)(report);
        (0, vitest_1.expect)(text.split('\n')[0]).toBe('AI detection looks healthy.');
        (0, vitest_1.expect)(text).toContain('✓ Local AI broker running');
    });
    (0, vitest_1.it)('never leaks source content', async () => {
        const report = await (0, aiDetectionSelfTest_1.runAiDetectionSelfTest)(deps());
        const text = (0, aiDetectionSelfTest_1.formatAiDetectionReport)(report).toLowerCase();
        for (const forbidden of ['diff', 'patch', 'prompt', 'content', 'source code']) {
            (0, vitest_1.expect)(text).not.toContain(forbidden);
        }
    });
});
//# sourceMappingURL=aiDetectionSelfTest.test.js.map