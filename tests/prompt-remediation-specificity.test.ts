import { describe, expect, it } from "vitest";
import { createRemediationSuggestions } from "../src/review/prompt-remediation-service";
import type { PromptReviewFinding } from "../src/review/prompt-review-types";

describe("prompt remediation specificity", () => {
  it("gives a generated-file action for filename comparison findings", () => {
    const findings: PromptReviewFinding[] = [
      {
        code: "filename",
        message: "Select a generated file to compare against the suggested filename.",
        severity: "warning",
        source: "existing-brand-qa",
        category: "warning",
      },
    ];

    const [suggestion] = createRemediationSuggestions(findings);
    expect(suggestion.category).toBe("output-contract");
    expect(suggestion.suggestedFix).toBe(
      "Select a generated file in Review so the app can compare its filename against the suggested export filename."
    );
  });

  it("produces specific prompt-clarity fixes for compiler warnings", () => {
    const findings: PromptReviewFinding[] = [
      {
        code: "compiler-warning-1",
        message: "Detected 12 content items. Use a dense card grid, action tracker or split the visual if readability suffers.",
        severity: "info",
        source: "prompt-clarity",
        category: "suggestion",
      },
      {
        code: "compiler-warning-2",
        message: "One or more visible text lines are long. Use wider text zones, cards, or compact typography.",
        severity: "info",
        source: "prompt-clarity",
        category: "suggestion",
      },
      {
        code: "compiler-warning-3",
        message: "Semantic Visible Text detected: 12 item(s), pattern financial_or_metric_cards. Preserve each field inside the correct card/row/lane.",
        severity: "info",
        source: "prompt-clarity",
        category: "suggestion",
      },
    ];

    const suggestions = createRemediationSuggestions(findings);

    expect(suggestions.map((suggestion) => suggestion.suggestedFix)).toEqual([
      "Keep the prompt, but use a dense card-grid or proof-point layout hint so the visual groups the many content items into distinct cards or lanes.",
      "Keep the exact wording, but use wider text zones, compact card formatting, or shorter line breaks in the source where wording can safely be split without changing meaning.",
      "Preserve the semantic structure explicitly: keep partner roles, metrics, and investor framing in separate cards, rows, or lanes rather than one generic text block.",
    ]);
  });
});
