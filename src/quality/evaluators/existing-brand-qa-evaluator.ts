import type { PromptBuildOutput } from "../../core/prompt-builder/prompt-build-types";
import type { GeneratedContentFile } from "../../lib/prompt-builder/project-generated-content-api";
import { buildBrandQaScorecard } from "../../lib/prompt-builder/workflow-features";
import type {
  DeterministicEvaluator,
  EvaluationResult,
  QualitySeverity,
} from "../types";

export type ExistingBrandQaContext = {
  output: PromptBuildOutput;
  selectedFile?: GeneratedContentFile | null;
  outputFilename?: string;
};

function severityForStatus(status: "pass" | "review" | "action"): QualitySeverity {
  if (status === "action") return "error";
  if (status === "review") return "warning";
  return "info";
}

export class ExistingBrandQaEvaluator implements DeterministicEvaluator<ExistingBrandQaContext> {
  readonly id = "existing-brand-qa";

  evaluate(context: ExistingBrandQaContext): EvaluationResult {
    const preview = context.output.promptPreview;
    const scorecard = buildBrandQaScorecard({
      logoAsset: preview.logoAsset,
      headerText: preview.headerText,
      footerText: preview.footerText,
      visibleText: preview.visibleText || preview.bodyContent,
      selectedFile: context.selectedFile,
      outputFilename: context.outputFilename,
      promptIssues: context.output.promptLint.issues,
    });

    return {
      evaluatorId: this.id,
      score: scorecard.score,
      findings: scorecard.items
        .filter((item) => item.status !== "pass")
        .map((item) => ({
          code: item.id,
          message: item.detail,
          severity: severityForStatus(item.status),
          source: this.id,
        })),
    };
  }
}
