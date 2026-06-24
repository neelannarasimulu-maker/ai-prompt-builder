import type { PromptReviewFinding } from "./prompt-review-types";
import type {
  RemediationCategory,
  RemediationSuggestion,
} from "./prompt-remediation-types";

const categoryLabels: Record<RemediationCategory, string> = {
  "source-content": "Source content",
  "brand-rules": "Brand rules",
  "output-contract": "Output contract",
  "prompt-clarity": "Prompt clarity",
  "document-rules": "Document rules",
  "visual-rules": "Visual rules",
  "linkedin-rules": "LinkedIn rules",
};

const codeCategories: Record<string, RemediationCategory> = {
  "missing-visible-text": "source-content",
  "missing-body-content": "source-content",
  "missing-document-source": "source-content",
  "missing-source-of-truth-section": "source-content",
  "legacy-sections-ignored": "source-content",
  "missing-logo": "brand-rules",
  "missing-logo-asset": "brand-rules",
  "missing-header": "brand-rules",
  "missing-footer": "brand-rules",
  "missing-brand-colours": "brand-rules",
  "logo-brand-mismatch": "brand-rules",
  "project-logo-outside-brand-assets": "brand-rules",
  "prompt-alias-mismatch": "output-contract",
  "missing-contract-prompt": "output-contract",
  "missing-render-contract": "output-contract",
  "missing-document-heading": "document-rules",
  "missing-document-section": "document-rules",
  "document-prompt-contamination": "document-rules",
  "missing-image-brief": "visual-rules",
  "missing-layout-plan": "visual-rules",
  "invalid-layout": "visual-rules",
  "invalid-background": "visual-rules",
  "linkedin-post-in-image-prompt": "linkedin-rules",
  "missing-linkedin-post-text": "linkedin-rules",
};

const categoryFixes: Record<RemediationCategory, string> = {
  "source-content": "Update the selected source Markdown so the required content is explicit and complete, then save and review again.",
  "brand-rules": "Update the project or brand rule source to resolve the missing brand asset or instruction, then review again.",
  "output-contract": "Review the selected output profile and contract requirements before generating the output.",
  "prompt-clarity": "Simplify ambiguous or duplicated source instructions while preserving the intended meaning.",
  "document-rules": "Update the document source or document rules to include the required structure and production constraints.",
  "visual-rules": "Update the visual source or visual rules with explicit visible text, image guidance and layout intent.",
  "linkedin-rules": "Keep LinkedIn post text separate from image instructions and provide the missing channel-specific source.",
};

function categoryFromSource(source: string): RemediationCategory {
  if (source.includes("source-of-truth")) return "source-content";
  if (source.includes("brand")) return "brand-rules";
  if (source.includes("output-contract")) return "output-contract";
  if (source.includes("document")) return "document-rules";
  if (source.includes("visual")) return "visual-rules";
  if (source.includes("linkedin")) return "linkedin-rules";
  return "prompt-clarity";
}

export function remediationCategoryLabel(category: RemediationCategory): string {
  return categoryLabels[category];
}

export function createRemediationSuggestions(
  findings: PromptReviewFinding[]
): RemediationSuggestion[] {
  const seen = new Set<string>();
  const suggestions: RemediationSuggestion[] = [];

  for (const finding of findings) {
    const id = `${finding.source}:${finding.code}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const category = codeCategories[finding.code] ?? categoryFromSource(finding.source);

    suggestions.push({
      id,
      findingCode: finding.code,
      source: finding.source,
      category,
      title: `${categoryLabels[category]}: ${finding.message}`,
      suggestedFix: categoryFixes[category],
    });
  }

  return suggestions;
}
