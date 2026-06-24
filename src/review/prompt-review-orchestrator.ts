import { ExistingBrandQaEvaluator } from "../quality/evaluators/existing-brand-qa-evaluator";
import { ExistingPromptLintEvaluator } from "../quality/evaluators/existing-prompt-lint-evaluator";
import { buildDeterministicScorecard } from "../quality/scoring/deterministic-scorecard";
import type {
  EvaluationResult,
  QualityFinding,
} from "../quality/types";
import {
  createBuiltInSkillRegistry,
  SkillRegistry,
} from "../skills/skill-registry";
import type { SkillOutput } from "../skills/types";
import type {
  PromptReviewCategory,
  PromptReviewEvaluator,
  PromptReviewFinding,
  PromptReviewInput,
  PromptReviewResult,
} from "./prompt-review-types";
import { createRemediationSuggestions } from "./prompt-remediation-service";
import {
  AgentRegistry,
  createBuiltInAgentRegistry,
} from "../agents/agent-registry";

function categoryForSeverity(severity: QualityFinding["severity"]): PromptReviewCategory {
  if (severity === "error") return "blocking";
  if (severity === "warning") return "warning";
  return "suggestion";
}

function scoreSkillResult(result: SkillOutput): number {
  const penalty = result.findings.reduce((total, finding) => {
    if (finding.severity === "error") return total + 18;
    if (finding.severity === "warning") return total + 8;
    return total + 3;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function skillEvaluation(result: SkillOutput): EvaluationResult {
  return {
    evaluatorId: `skill:${result.skillId}`,
    score: scoreSkillResult(result),
    findings: result.findings.map((finding) => ({ ...finding })),
  };
}

function recommendedActions(findings: PromptReviewFinding[]): string[] {
  return findings.map((finding) => {
    if (finding.category === "blocking") return `Resolve ${finding.code}: ${finding.message}`;
    if (finding.category === "warning") return `Review ${finding.code}: ${finding.message}`;
    return `Consider ${finding.code}: ${finding.message}`;
  });
}

export function createDefaultReviewEvaluators(): PromptReviewEvaluator[] {
  const lint = new ExistingPromptLintEvaluator();
  const brandQa = new ExistingBrandQaEvaluator();

  return [
    {
      id: lint.id,
      evaluate: ({ buildOutput }) => lint.evaluate(buildOutput),
    },
    {
      id: brandQa.id,
      evaluate: ({ buildOutput }) => brandQa.evaluate({ output: buildOutput }),
    },
  ];
}

export class PromptReviewOrchestrator {
  private readonly evaluatorMap: Map<string, PromptReviewEvaluator>;

  constructor(
    evaluators: PromptReviewEvaluator[] = createDefaultReviewEvaluators(),
    private readonly skills: SkillRegistry = createBuiltInSkillRegistry(),
    private readonly agents: AgentRegistry = createBuiltInAgentRegistry()
  ) {
    this.evaluatorMap = new Map();
    for (const evaluator of evaluators) {
      if (this.evaluatorMap.has(evaluator.id)) {
        throw new Error(`Review evaluator ID is already registered: ${evaluator.id}`);
      }
      this.evaluatorMap.set(evaluator.id, evaluator);
    }
  }

  review(input: PromptReviewInput): PromptReviewResult {
    const evaluatorIds = input.enabledEvaluatorIds ?? Array.from(this.evaluatorMap.keys());
    const skillIds = input.enabledSkillIds ?? this.skills.list().map((skill) => skill.id);

    const evaluatorResults = evaluatorIds.map((id) => {
      const evaluator = this.evaluatorMap.get(id);
      if (!evaluator) throw new Error(`Unknown review evaluator ID: ${id}`);
      return evaluator.evaluate(input);
    });
    const skillInput = {
      buildInput: input.buildInput,
      buildOutput: input.buildOutput,
    };
    const skillResults = skillIds.map((id) => this.skills.execute(id, skillInput));
    const skillEvaluations = skillResults.map(skillEvaluation);
    const dimensions = [...evaluatorResults, ...skillEvaluations];
    const scorecard = buildDeterministicScorecard(dimensions);
    const findings = scorecard.findings.map((finding) => ({
      ...finding,
      category: categoryForSeverity(finding.severity),
    }));
    const dimensionScores = Object.fromEntries([
      ...evaluatorResults.map((result) => [`evaluator:${result.evaluatorId}`, result.score]),
      ...skillResults.map((result) => [`skill:${result.skillId}`, scoreSkillResult(result)]),
    ]);
    const remediationSuggestions = createRemediationSuggestions(findings);
    const agentRuns = this.agents.runAll({
      buildInput: input.buildInput,
      buildOutput: input.buildOutput,
      evaluatorResults,
      skillResults,
      findings,
      remediationSuggestions,
    });

    return {
      overallScore: scorecard.score,
      dimensionScores,
      findings,
      skillResults,
      evaluatorResults,
      scorecard,
      recommendedNextActions: recommendedActions(findings),
      remediationSuggestions,
      agentRuns,
    };
  }
}
