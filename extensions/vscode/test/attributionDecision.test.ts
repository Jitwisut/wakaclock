import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AttributionDecisionInput,
  decideAttribution
} from "../src/attributionDecision";

interface FixtureCase {
  id: string;
  input: AttributionDecisionInput;
  expected: {
    kind: "resolved" | "rejected";
    actor_type?: "human" | "ai_verified" | "ai_inferred" | "unknown";
    confidence?: number;
  };
}

interface Fixture {
  schema_version: number;
  contract: string;
  cases: FixtureCase[];
}

const fixturePath = path.resolve(__dirname, "../../../fixtures/ai-attribution/decision-v1.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Fixture;

describe("canonical attribution decision conformance", () => {
  it("matches the shared decision-v1 fixture", () => {
    expect(fixture.schema_version).toBe(1);
    expect(fixture.contract).toBe("canonical_attribution_decision");
    expect(fixture.cases.length).toBeGreaterThan(0);

    for (const testCase of fixture.cases) {
      const actual = decideAttribution(testCase.input);
      expect(actual.kind, testCase.id).toBe(testCase.expected.kind);
      if (testCase.expected.kind === "resolved") {
        expect(actual).toMatchObject({
          kind: "resolved",
          actor_type: testCase.expected.actor_type,
          confidence: testCase.expected.confidence
        });
      }
    }
  });
});
