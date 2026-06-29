import { describe, expect, it } from "vitest";
import { compilePrompt } from "../src/lib/prompt-builder";
import { PromptReviewOrchestrator } from "../src/review/prompt-review-orchestrator";

describe("enterprise proof-point prompt review fixes", () => {
  it("accepts enterprise investor preset hints without unknown-preset warnings", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      markdownOverride: [
        "## Intent",
        "Test intent.",
        "",
        "## Layout Hint",
        "enterprise_proof_point_snapshot",
        "",
        "## Background Hint",
        "open_avbob_institutional_depth",
        "",
        "## Visible Text",
        "Test visible text.",
        "",
        "## Image Brief",
        "Test image brief.",
      ].join("\n"),
    });

    expect(result.warnings).not.toContain("Unknown layout preset: enterprise_proof_point_snapshot.");
    expect(result.warnings).not.toContain("Unknown background preset: open_avbob_institutional_depth.");
    expect(result.productionPrompt).toContain("Layout preset: enterprise_proof_point_snapshot");
    expect(result.productionPrompt).toContain("Background preset: open_avbob_institutional_depth");
  });

  it("downgrades compiler warnings to suggestions in prompt review", () => {
    const buildOutput = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      markdownOverride: [
        "## Intent",
        "Test intent.",
        "",
        "## Visible Text",
        "Title: Example enterprise proof point",
        "Body: This is a deliberately long line that pushes beyond the usual comfort threshold so the compiler emits a readability warning for prompt review scoring.",
        "",
        "## Image Brief",
        "Test image brief.",
      ].join("\n"),
    });

    const result = new PromptReviewOrchestrator().review({
      buildInput: {
        brandId: "supplysync360",
        projectId: "brand-positioning",
        contentId: "ss360-slide-01",
        outputProfileId: "landscape_image_16_9",
      },
      buildOutput,
    });

    const compilerFinding = result.findings.find((finding) => finding.code === "compiler-warning-1");

    expect(buildOutput.warnings.length).toBeGreaterThan(0);
    expect(compilerFinding).toBeDefined();
    expect(compilerFinding?.severity).toBe("info");
    expect(compilerFinding?.category).toBe("suggestion");
    expect(result.recommendedNextActions.some((action) => action.startsWith("Consider compiler-warning-1:"))).toBe(true);
  });
});
