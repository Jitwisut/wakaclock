"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const vitest_1 = require("vitest");
const attributionDecision_1 = require("../src/attributionDecision");
const fixturePath = path.resolve(__dirname, "../../../fixtures/ai-attribution/decision-v1.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
(0, vitest_1.describe)("canonical attribution decision conformance", () => {
    (0, vitest_1.it)("permits unknown authorship with measured characters and unavailable lines", () => {
        (0, vitest_1.expect)((0, attributionDecision_1.decideAttribution)({ explicit_actor_type: "unknown", chars_added: 3, chars_deleted: 2 })).toEqual({ kind: "resolved", actor_type: "unknown", confidence: 0 });
        (0, vitest_1.expect)((0, attributionDecision_1.decideAttribution)({ explicit_actor_type: "unknown", human_lines_added: 1 }).kind).toBe("rejected");
        (0, vitest_1.expect)((0, attributionDecision_1.decideAttribution)({ explicit_actor_type: "unknown", ai_lines_added: 1 }).kind).toBe("rejected");
        (0, vitest_1.expect)((0, attributionDecision_1.decideAttribution)({ explicit_actor_type: "unknown", positive_editor_evidence: true }).kind).toBe("rejected");
    });
    (0, vitest_1.it)("matches the shared decision-v1 fixture", () => {
        (0, vitest_1.expect)(fixture.schema_version).toBe(1);
        (0, vitest_1.expect)(fixture.contract).toBe("canonical_attribution_decision");
        (0, vitest_1.expect)(fixture.cases.length).toBeGreaterThan(0);
        for (const testCase of fixture.cases) {
            const actual = (0, attributionDecision_1.decideAttribution)(testCase.input);
            (0, vitest_1.expect)(actual.kind, testCase.id).toBe(testCase.expected.kind);
            if (testCase.expected.kind === "resolved") {
                (0, vitest_1.expect)(actual).toMatchObject({
                    kind: "resolved",
                    actor_type: testCase.expected.actor_type,
                    confidence: testCase.expected.confidence
                });
            }
        }
    });
});
//# sourceMappingURL=attributionDecision.test.js.map