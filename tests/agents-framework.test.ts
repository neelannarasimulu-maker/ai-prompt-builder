import { describe, expect, it } from "vitest";
import {
  builtInAgents,
  createBuiltInAgentRegistry,
} from "../src/agents/agent-registry";
import { PromptBuildService } from "../src/core/prompt-builder/prompt-build-service";
import { PromptReviewOrchestrator } from "../src/review/prompt-review-orchestrator";
import { contentItems } from "../src/lib/prompt-builder";

function fixture() {
  const content = contentItems.find((item) =>
    item.path.endsWith("content/projects/supplysync360/brand-positioning/visuals/executive-overview-set/01-business-overview.md")
  );
  if (!content) throw new Error("Missing agent fixture.");

  const buildInput = {
    brandId: content.brandId,
    projectId: content.projectId,
    contentId: content.id,
    outputProfileId: "landscape_image_16_9",
  };
  const buildOutput = new PromptBuildService().build(buildInput);
  const review = new PromptReviewOrchestrator().review({ buildInput, buildOutput });

  return { buildInput, buildOutput, review };
}

describe("deterministic prompt agents", () => {
  it("registers the five built-in agents in stable order", () => {
    expect(createBuiltInAgentRegistry().list().map((agent) => agent.id))
      .toEqual(builtInAgents.map((agent) => agent.id));
  });

  it("runs deterministically with read-only result metadata", () => {
    const { buildInput, buildOutput, review } = fixture();
    const registry = createBuiltInAgentRegistry();
    const input = {
      buildInput,
      buildOutput,
      evaluatorResults: review.evaluatorResults,
      skillResults: review.skillResults,
      findings: review.findings,
      remediationSuggestions: review.remediationSuggestions,
    };

    expect(registry.runAll(input)).toEqual(registry.runAll(input));
    for (const result of registry.runAll(input)) {
      expect(result.durationMs).toBe(0);
      expect(["passed", "advisory", "blocked"]).toContain(result.status);
    }
  });

  it("includes every agent run in the prompt review result", () => {
    const { review } = fixture();

    expect(review.agentRuns.map((agent) => agent.id))
      .toEqual(builtInAgents.map((agent) => agent.id));
  });
});
