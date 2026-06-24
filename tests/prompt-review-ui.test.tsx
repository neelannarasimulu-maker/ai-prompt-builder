import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFeatureFlag, setFeatureFlag, subscribeToFeatureFlags } from "../src/core/feature-flags";
import { PromptBuildService } from "../src/core/prompt-builder/prompt-build-service";
import { PromptQualityReviewPanel } from "../src/features/prompt-builder/prompt-quality-review-panel";
import {
  formatReviewSummary,
  formatAgentResults,
  formatExecutiveReviewSummary,
  formatFixChecklist,
  formatFullReview,
  formatPriorityFixes,
  formatSuggestedFixes,
  formatTopFindings,
} from "../src/features/prompt-builder/prompt-review-copy";
import { PromptReviewService } from "../src/review/prompt-review-service";
import { contentItems } from "../src/lib/prompt-builder";

function reviewResult() {
  const content = contentItems.find((item) =>
    item.path.endsWith("content/projects/supplysync360/brand-positioning/visuals/executive-overview-set/01-business-overview.md")
  );
  if (!content) throw new Error("Missing review UI fixture.");

  const buildInput = {
    brandId: content.brandId,
    projectId: content.projectId,
    contentId: content.id,
    outputProfileId: "landscape_image_16_9",
  };
  const buildOutput = new PromptBuildService().build(buildInput);
  return new PromptReviewService().review(buildInput, buildOutput);
}

describe("Prompt Quality Review UI", () => {
  it("defaults promptReview.enabled to false and hides the panel", () => {
    expect(readFeatureFlag("promptReview.enabled", undefined)).toBe(false);
    expect(renderToStaticMarkup(
      <PromptQualityReviewPanel enabled={false} result={reviewResult()} />
    )).toBe("");
  });

  it("persists toggle changes and exposes them immediately", () => {
    const values = new Map<string, string>();
    let notifications = 0;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const unsubscribe = subscribeToFeatureFlags(() => { notifications += 1; });

    setFeatureFlag("promptReview.enabled", true, storage);
    expect(readFeatureFlag("promptReview.enabled", storage)).toBe(true);
    expect(values.get("promptReview.enabled")).toBe("true");

    setFeatureFlag("promptReview.enabled", false, storage);
    expect(readFeatureFlag("promptReview.enabled", storage)).toBe(false);
    expect(notifications).toBe(2);
    unsubscribe();
  });

  it("renders the deterministic review when the flag is true", () => {
    const html = renderToStaticMarkup(
      <PromptQualityReviewPanel enabled result={reviewResult()} />
    );

    expect(html).toContain("Prompt Quality Review");
    expect(html).toContain("Priority Fixes");
    expect(html).toContain("Score Breakdown");
    expect(html).toContain("Detailed Findings");
    expect(html).toContain("Snapshots &amp; Comparison");
    expect(html).toContain("Blocking");
    expect(html).toContain("Copy executive summary");
    expect(html).toContain("Copy priority fixes");
    expect(html).toContain("Copy full review");
    expect(html).toContain("Copy fix checklist");
    expect(html).toContain("Where to fix");
    expect(html).toContain("Why it matters");
    expect(html).toContain("Suggested edit");
    expect(html).toContain("Save review snapshot");
    expect(html).toContain("Clear snapshots");
    expect(html).toContain("Copy comparison summary");
    expect(html).toContain("Agent Results");
    expect(html).toContain("<details");
    const remediation = reviewResult().agentRuns.find((agent) => agent.id === "remediation-advisor-agent");
    expect(html).toContain(`${remediation?.recommendations.length ?? 0} suggested fixes`);
  });

  it("formats deterministic copy text without prompt content", () => {
    const result = reviewResult();
    const summary = formatReviewSummary(result);
    const findings = formatTopFindings(result);
    const fixes = formatSuggestedFixes(result);
    const agents = formatAgentResults(result);
    const executive = formatExecutiveReviewSummary(result);
    const priorities = formatPriorityFixes(result);
    const full = formatFullReview(result);
    const checklist = formatFixChecklist(result);

    expect(summary).toContain(`Overall score: ${result.overallScore}/100`);
    expect(summary).toContain("Dimension scores:");
    expect(findings).toContain("Prompt Quality Review - Top Findings");
    expect(fixes).toContain("Prompt Quality Review - Suggested Fixes");
    expect(agents).toContain("Prompt Quality Review - Agent Results");
    expect(executive).toContain("Prompt Quality Review - Executive Summary");
    expect(priorities).toContain("Prompt Quality Review - Priority Fixes");
    expect(full).toContain("Detailed Findings");
    expect(checklist).toContain("Prompt Quality Review - Fix Checklist");
    expect(checklist).toContain("Where to fix:");
    expect(checklist).toContain("Why it matters:");
    expect(checklist).toContain("Suggested edit:");
    for (const agent of result.agentRuns) {
      expect(agents).toContain(agent.name);
    }
    for (const suggestion of result.remediationSuggestions) {
      expect(fixes).toContain(suggestion.suggestedFix);
    }
    expect(summary).not.toContain(result.evaluatorResults[0]?.findings[0]?.message || "__missing__");
  });
});
