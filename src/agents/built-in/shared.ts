import type {
  PromptAgent,
  PromptAgentInput,
  PromptAgentRun,
  PromptAgentStatus,
} from "../agent-types";
import type { QualityFinding } from "../../quality/types";
import type { PromptReviewFinding } from "../../review/prompt-review-types";
import { createBuiltInSkillRegistry } from "../../skills/skill-registry";

const skills = createBuiltInSkillRegistry();

function category(severity: QualityFinding["severity"]): PromptReviewFinding["category"] {
  if (severity === "error") return "blocking";
  if (severity === "warning") return "warning";
  return "suggestion";
}

function score(findings: PromptReviewFinding[]): number {
  const penalty = findings.reduce((total, finding) => {
    if (finding.category === "blocking") return total + 18;
    if (finding.category === "warning") return total + 8;
    return total + 3;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function status(findings: PromptReviewFinding[]): PromptAgentStatus {
  if (findings.some((finding) => finding.category === "blocking")) return "blocked";
  if (findings.length > 0) return "advisory";
  return "passed";
}

export function defineSkillAgent(definition: {
  id: string;
  name: string;
  role: string;
  description: string;
  skillsUsed: string[];
}): PromptAgent {
  return {
    ...definition,
    inputs: ["buildInput", "buildOutput"],
    run(input: PromptAgentInput): PromptAgentRun {
      const findings = definition.skillsUsed.flatMap((skillId) =>
        skills.execute(skillId, {
          buildInput: input.buildInput,
          buildOutput: input.buildOutput,
        }).findings.map((finding) => ({
          ...finding,
          category: category(finding.severity),
        }))
      );
      const recommendations = findings.map((finding) =>
        `Review ${finding.code}: ${finding.message}`
      );

      return {
        ...definition,
        inputs: ["buildInput", "buildOutput"],
        result: findings.length === 0
          ? "No advisory findings."
          : `${findings.length} advisory finding${findings.length === 1 ? "" : "s"}.`,
        findings,
        recommendations,
        status: status(findings),
        score: score(findings),
        durationMs: 0,
      };
    },
  };
}

export function agentStatus(findings: PromptReviewFinding[]): PromptAgentStatus {
  return status(findings);
}

export function agentScore(findings: PromptReviewFinding[]): number {
  return score(findings);
}
