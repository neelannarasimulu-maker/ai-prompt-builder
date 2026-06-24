import type {
  PromptBuildInput,
  PromptBuildOutput,
} from "../core/prompt-builder/prompt-build-types";
import type {
  EvaluationResult,
  QualityFinding,
  QualityScorecard,
} from "../quality/types";
import type { SkillOutput } from "../skills/types";
import type { RemediationSuggestion } from "./prompt-remediation-types";
import type { PromptAgentRun } from "../agents/agent-types";

export type PromptReviewCategory = "blocking" | "warning" | "suggestion";

export type PromptReviewInput = {
  buildInput: PromptBuildInput;
  buildOutput: PromptBuildOutput;
  enabledEvaluatorIds?: string[];
  enabledSkillIds?: string[];
};

export type PromptReviewFinding = QualityFinding & {
  category: PromptReviewCategory;
};

export type PromptReviewResult = {
  overallScore: number;
  dimensionScores: Record<string, number>;
  findings: PromptReviewFinding[];
  skillResults: SkillOutput[];
  evaluatorResults: EvaluationResult[];
  scorecard: QualityScorecard;
  recommendedNextActions: string[];
  remediationSuggestions: RemediationSuggestion[];
  agentRuns: PromptAgentRun[];
};

export type PromptBuildAndReviewResult = {
  buildOutput: PromptBuildOutput;
  review: PromptReviewResult;
};

export type PromptReviewEvaluator = {
  id: string;
  evaluate(input: PromptReviewInput): EvaluationResult;
};
