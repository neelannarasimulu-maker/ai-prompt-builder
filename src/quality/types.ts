export type QualitySeverity = "error" | "warning" | "info";

export type QualityFinding = {
  code: string;
  message: string;
  severity: QualitySeverity;
  source: string;
};

export type EvaluationResult = {
  evaluatorId: string;
  score: number;
  findings: QualityFinding[];
};

export interface DeterministicEvaluator<TContext> {
  readonly id: string;
  evaluate(context: TContext): EvaluationResult;
}

export type QualityScorecard = {
  score: number;
  evaluatorCount: number;
  blockingCount: number;
  advisoryCount: number;
  evaluations: EvaluationResult[];
  findings: QualityFinding[];
};
