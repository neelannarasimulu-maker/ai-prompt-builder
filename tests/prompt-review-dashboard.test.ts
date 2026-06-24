import { describe, expect, it } from "vitest";
import { buildPromptReviewDashboard } from "../src/review/prompt-review-dashboard";
import type { PromptReviewResult } from "../src/review/prompt-review-types";

function resultWithDuplicates(): PromptReviewResult {
  const finding = {
    code: "missing-logo",
    message: "No logo asset is resolved.",
    severity: "warning" as const,
    source: "brand-consistency",
    category: "warning" as const,
  };

  return {
    overallScore: 72,
    dimensionScores: {},
    findings: [finding],
    skillResults: [],
    evaluatorResults: [],
    scorecard: {
      score: 72,
      evaluatorCount: 0,
      blockingCount: 0,
      advisoryCount: 1,
      evaluations: [],
      findings: [],
    },
    recommendedNextActions: [],
    remediationSuggestions: [{
      id: "brand-consistency:missing-logo",
      findingCode: "missing-logo",
      source: "brand-consistency",
      category: "brand-rules",
      title: "Brand rules: No logo asset is resolved.",
      suggestedFix: "Select the correct brand logo.",
    }],
    agentRuns: [{
      id: "brand-guardian-agent",
      name: "Brand Guardian Agent",
      role: "Brand consistency reviewer",
      description: "Checks brand consistency.",
      inputs: [],
      skillsUsed: ["brand-consistency"],
      result: "1 advisory finding.",
      findings: [{ ...finding }],
      recommendations: ["Select the correct brand logo."],
      status: "advisory",
      score: 92,
      durationMs: 0,
    }],
  };
}

describe("prompt review dashboard", () => {
  it("de-duplicates repeated findings while retaining sources and fixes", () => {
    const dashboard = buildPromptReviewDashboard(resultWithDuplicates());

    expect(dashboard.issues).toHaveLength(1);
    expect(dashboard.issues[0].sources).toEqual(["brand-consistency"]);
    expect(dashboard.issues[0].suggestedFixes).toEqual(["Select the correct brand logo."]);
    expect(dashboard.issues[0].guidance.likelySourceSection).toBe("Brand rules");
  });

  it("derives an executive status and top-three priorities deterministically", () => {
    const result = resultWithDuplicates();

    expect(buildPromptReviewDashboard(result)).toEqual(buildPromptReviewDashboard(result));
    expect(buildPromptReviewDashboard(result).status).toBe("Needs Review");
    expect(buildPromptReviewDashboard(result).priorities).toHaveLength(1);
  });
});
