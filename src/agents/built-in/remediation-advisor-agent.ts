import { createRemediationSuggestions } from "../../review/prompt-remediation-service";
import type {
  PromptAgent,
  PromptAgentInput,
  PromptAgentRun,
} from "../agent-types";
import { agentScore, agentStatus } from "./shared";

export const remediationAdvisorAgent: PromptAgent = {
  id: "remediation-advisor-agent",
  name: "Remediation Advisor Agent",
  role: "Deterministic remediation advisor",
  description: "Converts review findings into practical read-only suggested fixes.",
  inputs: ["findings", "remediationSuggestions"],
  skillsUsed: [
    "source-of-truth",
    "brand-consistency",
    "output-contract",
    "prompt-clarity",
    "document-rules",
    "visual-rules",
    "linkedin-rules",
  ],
  run(input: PromptAgentInput): PromptAgentRun {
    const suggestions = createRemediationSuggestions(input.findings);
    const findings = input.findings.map((finding) => ({ ...finding }));

    return {
      id: this.id,
      name: this.name,
      role: this.role,
      description: this.description,
      inputs: [...this.inputs],
      skillsUsed: [...this.skillsUsed],
      result: suggestions.length === 0
        ? "No remediation suggestions."
        : `${suggestions.length} suggested fix${suggestions.length === 1 ? "" : "es"}.`,
      findings,
      recommendations: suggestions.map((suggestion) => suggestion.suggestedFix),
      status: agentStatus(findings),
      score: agentScore(findings),
      durationMs: 0,
    };
  },
};
