import { backgroundPresets } from "./background-presets";
import { getSection, type ParsedSections } from "./content-sections";
import { layoutPresets } from "./layout-presets";
import type { DynamicLayoutPlan } from "./layout-solver";
import type { OutputProfileLike, OutputType } from "./prompt-compiler";

export type PromptLintIssue = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
};

export type PromptLintResult = {
  issues: PromptLintIssue[];
  fidelityScore: number;
};

function addIssue(
  issues: PromptLintIssue[],
  severity: PromptLintIssue["severity"],
  code: string,
  message: string
): void {
  if (!issues.some((issue) => issue.code === code && issue.message === message)) {
    issues.push({ severity, code, message });
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle.trim()) return 0;
  return haystack.split(needle).length - 1;
}

function wordCount(input: string): number {
  return input.trim() ? input.trim().split(/\s+/).length : 0;
}

function scoreFromIssues(issues: PromptLintIssue[]): number {
  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === "error") return total + 18;
    if (issue.severity === "warning") return total + 8;
    return total + 3;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

export function lintCompiledPrompt(input: {
  outputProfile: OutputProfileLike;
  sections: ParsedSections;
  productionPrompt: string;
  plan: DynamicLayoutPlan;
  brandId?: string;
  logoAsset?: string;
  logoSource?: "content" | "project" | "brand-rules" | "registry" | "none";
  logoIsOutsideBrandAssets?: boolean;
  logoSvgHasPngAlternative?: boolean;
  brandColours?: string;
}): PromptLintResult {
  const issues: PromptLintIssue[] = [];
  const outputType: OutputType = input.outputProfile.outputType;
  const visibleText = getSection(input.sections, "Visible Text");
  const imageBrief = getSection(input.sections, "Image Brief");
  const bodyContent = getSection(input.sections, "Body Content", "Document Body Content", "Body");
  const bodySource = bodyContent || visibleText;

  if (outputType === "image") {
    if (!visibleText) addIssue(issues, "error", "missing-visible-text", "Image output is missing Visible Text.");
    if (!imageBrief) addIssue(issues, "warning", "missing-image-brief", "Image output is missing Image Brief guidance.");
    if (visibleText && !input.productionPrompt.includes("BEGIN EXACT VISIBLE TEXT")) {
      addIssue(issues, "error", "visible-text-not-delimited", "Visible Text is not wrapped in hard delimiters.");
    }
    if (visibleText && countOccurrences(input.productionPrompt, visibleText.trim()) > 1) {
      addIssue(issues, "warning", "visible-text-duplicated", "Visible Text appears more than once in the production prompt.");
    }
    if (!input.productionPrompt.includes("Brand colours:")) {
      addIssue(issues, "warning", "missing-brand-colours", "Image prompt is missing explicit brand colours.");
    }
    if (!input.logoAsset) {
      addIssue(issues, "warning", "missing-logo-asset", "Image prompt has no resolved brand logo asset.");
    }
  }

  if (outputType === "document" || outputType === "pdf") {
    if (!bodySource) addIssue(issues, "error", "missing-body-content", "Document/PDF output is missing Body Content or Visible Text.");
    if (
      !input.productionPrompt.includes("BEGIN SOURCE MARKDOWN") &&
      !input.productionPrompt.includes("Attached source file workflow")
    ) {
      addIssue(issues, "warning", "document-source-not-delimited", "Document prompt does not include inline source Markdown or an attached-source workflow.");
    }
    if (!input.productionPrompt.includes("Brand colours:")) {
      addIssue(issues, "warning", "missing-brand-colours", "Document/PDF prompt is missing explicit brand colours.");
    }
  }

  if (!layoutPresets.some((preset) => preset.id === input.plan.layoutPresetId)) {
    addIssue(issues, "error", "invalid-layout", `Unknown layout preset: ${input.plan.layoutPresetId}.`);
  }

  if (!backgroundPresets.some((preset) => preset.id === input.plan.backgroundPresetId)) {
    addIssue(issues, "error", "invalid-background", `Unknown background preset: ${input.plan.backgroundPresetId}.`);
  }

  if (input.plan.density.wordCount > 240 && outputType === "image") {
    addIssue(issues, "warning", "image-text-too-dense", "Visible Text is very dense for a single image.");
  }

  const words = wordCount(input.productionPrompt);
  if (outputType === "image" && words > 700) {
    addIssue(issues, "warning", "image-prompt-too-long", `Image prompt is ${words} words; target is 350-700 words.`);
  }
  if ((outputType === "document" || outputType === "pdf") && !input.productionPrompt.includes("BEGIN SOURCE MARKDOWN") && words > 900) {
    addIssue(issues, "warning", "document-prompt-too-long", `Document prompt is ${words} words before source content; target is 500-900 words.`);
  }

  if (countOccurrences(input.productionPrompt, "Logo:") > 1 || countOccurrences(input.productionPrompt, "Logo asset") > 1) {
    addIssue(issues, "warning", "duplicate-logo-rules", "Logo guidance appears more than once.");
  }
  if (countOccurrences(input.productionPrompt, "Use only the text") > 1 || countOccurrences(input.productionPrompt, "Use only the Visible Text") > 1) {
    addIssue(issues, "warning", "duplicate-visible-text-rules", "Visible-text source rules appear more than once.");
  }
  if (/brand palette above/i.test(input.productionPrompt)) {
    addIssue(issues, "warning", "vague-brand-palette-reference", "Prompt references a brand palette without explicitly listing colours.");
  }
  if (input.brandColours && /^derive colours from/i.test(input.brandColours)) {
    addIssue(issues, "warning", "brand-palette-not-found", "Resolved brand has no explicit palette line or hex-code colour rules.");
  }
  if (input.brandId && input.logoAsset) {
    const normalizedLogo = input.logoAsset.replace(/\\/g, "/").toLowerCase();
    if (!normalizedLogo.includes(`/brands/${input.brandId.toLowerCase()}/`)) {
      addIssue(issues, "warning", "logo-brand-mismatch", `Logo asset does not appear to belong to brandId ${input.brandId}.`);
    }
  }
  if (input.logoIsOutsideBrandAssets) {
    addIssue(issues, "warning", "project-logo-outside-brand-assets", "Resolved project logo points outside the selected brand assets folder.");
  }
  if (input.logoSvgHasPngAlternative) {
    addIssue(issues, "warning", "svg-logo-when-png-exists", "Resolved logo is SVG even though a PNG equivalent exists.");
  }
  if ((outputType === "image" || outputType === "document" || outputType === "pdf") && input.logoSource !== "project" && input.logoSource !== "content") {
    addIssue(issues, "info", "project-logo-not-selected", "No project logo selection was found; using brand fallback logo.");
  }

  return {
    issues,
    fidelityScore: scoreFromIssues(issues),
  };
}
