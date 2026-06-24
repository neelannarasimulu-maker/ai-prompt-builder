import type { PromptBuildOutput } from "../../core/prompt-builder/prompt-build-types";
import type {
  DeterministicEvaluator,
  EvaluationResult,
} from "../types";

export class ExistingPromptLintEvaluator implements DeterministicEvaluator<PromptBuildOutput> {
  readonly id = "existing-prompt-lint";

  evaluate(output: PromptBuildOutput): EvaluationResult {
    return {
      evaluatorId: this.id,
      score: output.promptLint.fidelityScore,
      findings: output.promptLint.issues.map((issue) => ({
        ...issue,
        source: this.id,
      })),
    };
  }
}
