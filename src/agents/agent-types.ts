import type {
  PromptBuildInput,
  PromptBuildOutput,
} from "../core/prompt-builder/prompt-build-types";
import type { EvaluationResult } from "../quality/types";
import type { RemediationSuggestion } from "../review/prompt-remediation-types";
import type { PromptReviewFinding } from "../review/prompt-review-types";
import type { SkillOutput } from "../skills/types";

export type PromptAgentStatus = "passed" | "advisory" | "blocked";

export type PromptAgentInput = {
  buildInput: PromptBuildInput;
  buildOutput: PromptBuildOutput;
  evaluatorResults: EvaluationResult[];
  skillResults: SkillOutput[];
  findings: PromptReviewFinding[];
  remediationSuggestions: RemediationSuggestion[];
};

export type PromptAgentRun = {
  id: string;
  name: string;
  role: string;
  description: string;
  inputs: string[];
  skillsUsed: string[];
  result: string;
  findings: PromptReviewFinding[];
  recommendations: string[];
  status: PromptAgentStatus;
  score: number;
  durationMs: number;
};

export interface PromptAgent {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly inputs: string[];
  readonly skillsUsed: string[];
  run(input: PromptAgentInput): PromptAgentRun;
}
