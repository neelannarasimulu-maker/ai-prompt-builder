import { describe, expect, it } from "vitest";
import { PromptBuildService } from "../src/core/prompt-builder/prompt-build-service";
import { createRemediationSuggestions } from "../src/review/prompt-remediation-service";
import { PromptReviewOrchestrator } from "../src/review/prompt-review-orchestrator";
import type { PromptReviewFinding } from "../src/review/prompt-review-types";
import { contentItems } from "../src/lib/prompt-builder";

const findings: PromptReviewFinding[] = [
  {
    code: "missing-logo",
    message: "No logo asset is resolved.",
    severity: "warning",
    source: "brand-consistency",
    category: "warning",
  },
  {
    code: "missing-visible-text",
    message: "No exact visible text is available.",
    severity: "error",
    source: "visual-rules",
    category: "blocking",
  },
];

describe("deterministic prompt remediation", () => {
  it("maps common findings to stable categorised suggestions", () => {
    expect(createRemediationSuggestions(findings)).toEqual(createRemediationSuggestions(findings));
    expect(createRemediationSuggestions(findings).map((suggestion) => suggestion.category))
      .toEqual(["brand-rules", "source-content"]);
  });

  it("does not mutate the compiled prompt", () => {
    const content = contentItems.find((item) =>
      item.path.endsWith("content/projects/supplysync360/brand-positioning/visuals/executive-overview-set/01-business-overview.md")
    );
    if (!content) throw new Error("Missing remediation fixture.");
    const buildInput = {
      brandId: content.brandId,
      projectId: content.projectId,
      contentId: content.id,
      outputProfileId: "landscape_image_16_9",
    };
    const buildOutput = new PromptBuildService().build(buildInput);
    const before = JSON.stringify(buildOutput);

    new PromptReviewOrchestrator().review({ buildInput, buildOutput });

    expect(JSON.stringify(buildOutput)).toBe(before);
  });
});
