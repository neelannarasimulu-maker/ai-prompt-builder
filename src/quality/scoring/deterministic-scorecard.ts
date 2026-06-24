import type {
  EvaluationResult,
  QualityScorecard,
} from "../types";

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function buildDeterministicScorecard(
  evaluations: EvaluationResult[]
): QualityScorecard {
  const normalized = evaluations.map((evaluation) => ({
    ...evaluation,
    score: clampScore(evaluation.score),
    findings: [...evaluation.findings],
  }));
  const findings = normalized.flatMap((evaluation) => evaluation.findings);
  const total = normalized.reduce((sum, evaluation) => sum + evaluation.score, 0);

  return {
    score: normalized.length === 0 ? 100 : Math.round(total / normalized.length),
    evaluatorCount: normalized.length,
    blockingCount: findings.filter((finding) => finding.severity === "error").length,
    advisoryCount: findings.filter((finding) => finding.severity !== "error").length,
    evaluations: normalized,
    findings,
  };
}
