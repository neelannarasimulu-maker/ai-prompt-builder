import { describe, expect, it } from "vitest";
import { PromptBuildService } from "../src/core/prompt-builder/prompt-build-service";
import { PromptReviewOrchestrator } from "../src/review/prompt-review-orchestrator";
import { PromptReviewService } from "../src/review/prompt-review-service";
import type { PromptReviewInput } from "../src/review/prompt-review-types";
import { builtInSkills } from "../src/skills/skill-registry";
import { contentItems } from "../src/lib/prompt-builder";

function fixture(): PromptReviewInput {
  const content = contentItems.find((item) =>
    item.path.endsWith("content/projects/supplysync360/brand-positioning/visuals/executive-overview-set/01-business-overview.md")
  );
  if (!content) throw new Error("Missing review fixture.");

  const buildInput = {
    brandId: content.brandId,
    projectId: content.projectId,
    contentId: content.id,
    outputProfileId: "landscape_image_16_9",
  };

  return {
    buildInput,
    buildOutput: new PromptBuildService().build(buildInput),
  };
}

describe("PromptReviewOrchestrator", () => {
  it("runs all enabled evaluators and skills", () => {
    const result = new PromptReviewOrchestrator().review(fixture());

    expect(result.evaluatorResults.map((evaluation) => evaluation.evaluatorId))
      .toEqual(["existing-prompt-lint", "existing-brand-qa"]);
    expect(result.skillResults.map((skill) => skill.skillId))
      .toEqual(builtInSkills.map((skill) => skill.id));
    expect(Object.keys(result.dimensionScores)).toHaveLength(2 + builtInSkills.length);
  });

  it("merges findings and scorecards deterministically", () => {
    const orchestrator = new PromptReviewOrchestrator();
    const input = fixture();

    expect(orchestrator.review(input)).toEqual(orchestrator.review(input));
  });

  it("categorises every finding and recommends actions in matching order", () => {
    const result = new PromptReviewOrchestrator().review(fixture());

    expect(result.recommendedNextActions).toHaveLength(result.findings.length);
    for (const finding of result.findings) {
      expect(["blocking", "warning", "suggestion"]).toContain(finding.category);
    }
  });

  it("does not mutate the compiled prompt", () => {
    const input = fixture();
    const before = JSON.stringify(input.buildOutput);

    new PromptReviewOrchestrator().review(input);

    expect(JSON.stringify(input.buildOutput)).toBe(before);
  });

  it("keeps build-and-review output byte-identical to PromptBuildService", () => {
    const input = fixture();
    const result = new PromptReviewService().buildAndReview(input.buildInput);

    expect(JSON.stringify(result.buildOutput)).toBe(JSON.stringify(input.buildOutput));
  });
});
