import { describe, expect, it } from "vitest";
import { PromptBuildService } from "../src/core/prompt-builder/prompt-build-service";
import { ExistingBrandQaEvaluator } from "../src/quality/evaluators/existing-brand-qa-evaluator";
import { ExistingPromptLintEvaluator } from "../src/quality/evaluators/existing-prompt-lint-evaluator";
import { buildDeterministicScorecard } from "../src/quality/scoring/deterministic-scorecard";
import { contentItems } from "../src/lib/prompt-builder";

function buildVisualFixture() {
  const content = contentItems.find((item) =>
    item.path.endsWith("content/projects/supplysync360/brand-positioning/visuals/executive-overview-set/01-business-overview.md")
  );
  if (!content) throw new Error("Missing quality fixture.");

  return new PromptBuildService().build({
    brandId: content.brandId,
    projectId: content.projectId,
    contentId: content.id,
    outputProfileId: "landscape_image_16_9",
  });
}

describe("prompt quality foundation", () => {
  it("wraps existing prompt lint without changing its score or findings", () => {
    const output = buildVisualFixture();
    const evaluation = new ExistingPromptLintEvaluator().evaluate(output);

    expect(evaluation.score).toBe(output.promptLint.fidelityScore);
    expect(evaluation.findings.map(({ source: _source, ...finding }) => finding))
      .toEqual(output.promptLint.issues);
  });

  it("builds the same deterministic scorecard for the same evaluations", () => {
    const output = buildVisualFixture();
    const evaluations = [
      new ExistingPromptLintEvaluator().evaluate(output),
      new ExistingBrandQaEvaluator().evaluate({ output }),
    ];

    expect(buildDeterministicScorecard(evaluations))
      .toEqual(buildDeterministicScorecard(evaluations));
  });
});
