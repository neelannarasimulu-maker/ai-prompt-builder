import type {
  PromptReviewFinding,
  PromptReviewResult,
} from "../../review/prompt-review-types";
import { remediationCategoryLabel } from "../../review/prompt-remediation-service";
import type { PromptReviewComparison } from "../../review/prompt-review-snapshots";
import { buildPromptReviewDashboard } from "../../review/prompt-review-dashboard";

function categoryCount(result: PromptReviewResult, category: PromptReviewFinding["category"]): number {
  return result.findings.filter((finding) => finding.category === category).length;
}

export function formatReviewSummary(result: PromptReviewResult): string {
  const dimensions = Object.entries(result.dimensionScores)
    .map(([dimension, score]) => `- ${dimension}: ${score}/100`);
  const actions = result.recommendedNextActions.slice(0, 5).map((action) => `- ${action}`);

  return [
    "Prompt Quality Review",
    `Overall score: ${result.overallScore}/100`,
    `Blocking: ${categoryCount(result, "blocking")}`,
    `Warnings: ${categoryCount(result, "warning")}`,
    `Suggestions: ${categoryCount(result, "suggestion")}`,
    "",
    "Dimension scores:",
    ...(dimensions.length ? dimensions : ["- None"]),
    "",
    "Recommended next actions:",
    ...(actions.length ? actions : ["- None"]),
  ].join("\n");
}

export function formatTopFindings(result: PromptReviewResult, limit = 6): string {
  const findings = result.findings.slice(0, limit).map((finding) =>
    `- [${finding.category.toUpperCase()}] ${finding.code}: ${finding.message}`
  );

  return [
    "Prompt Quality Review - Top Findings",
    ...(findings.length ? findings : ["- No advisory findings."]),
  ].join("\n");
}

export function formatSuggestedFixes(result: PromptReviewResult): string {
  const suggestions = result.remediationSuggestions.map((suggestion) => [
    `[${remediationCategoryLabel(suggestion.category)}] ${suggestion.title}`,
    `Suggested fix: ${suggestion.suggestedFix}`,
  ].join("\n"));

  return [
    "Prompt Quality Review - Suggested Fixes",
    ...(suggestions.length ? suggestions : ["No suggested fixes."]),
  ].join("\n\n");
}

function delta(value: number | null): string {
  if (value === null) return "N/A";
  return value > 0 ? `+${value}` : String(value);
}

export function formatReviewComparison(comparison: PromptReviewComparison): string {
  return [
    "Prompt Quality Review - Comparison",
    `Current score: ${comparison.currentScore}/100`,
    `Previous saved score: ${comparison.previousScore === null ? "N/A" : `${comparison.previousScore}/100`}`,
    `Score delta: ${delta(comparison.scoreDelta)}`,
    `Current findings: ${comparison.currentFindingCount}`,
    `Finding count delta: ${delta(comparison.findingCountDelta)}`,
    `Current suggested fixes: ${comparison.currentSuggestedFixCount}`,
    `Suggested fix count delta: ${delta(comparison.suggestedFixCountDelta)}`,
  ].join("\n");
}

export function formatAgentResults(result: PromptReviewResult): string {
  const agents = result.agentRuns.map((agent) => [
    `${agent.name} [${agent.status.toUpperCase()}] - ${agent.id === "remediation-advisor-agent" ? `${agent.recommendations.length} suggested fixes` : `${agent.score}/100`}`,
    `Role: ${agent.role}`,
    `Skills used: ${agent.skillsUsed.join(", ") || "None"}`,
    `Result: ${agent.result}`,
    "Top findings:",
    ...(agent.findings.slice(0, 3).map((finding) => `- ${finding.code}: ${finding.message}`).length
      ? agent.findings.slice(0, 3).map((finding) => `- ${finding.code}: ${finding.message}`)
      : ["- None"]),
    "Recommendations:",
    ...(agent.recommendations.slice(0, 3).map((recommendation) => `- ${recommendation}`).length
      ? agent.recommendations.slice(0, 3).map((recommendation) => `- ${recommendation}`)
      : ["- None"]),
  ].join("\n"));

  return [
    "Prompt Quality Review - Agent Results",
    ...(agents.length ? agents : ["No agent results."]),
  ].join("\n\n");
}

export function formatExecutiveReviewSummary(result: PromptReviewResult): string {
  const dashboard = buildPromptReviewDashboard(result);
  return [
    "Prompt Quality Review - Executive Summary",
    `Overall score: ${result.overallScore}/100`,
    `Status: ${dashboard.status}`,
    `Issues: ${dashboard.counts.blocking} blocking, ${dashboard.counts.warning} warning, ${dashboard.counts.suggestion} suggestion`,
    "",
    "Top priorities:",
    ...(dashboard.priorities.length
      ? dashboard.priorities.map((issue, index) => `${index + 1}. ${issue.message}`)
      : ["1. No priority fixes."]),
  ].join("\n");
}

export function formatPriorityFixes(result: PromptReviewResult): string {
  const dashboard = buildPromptReviewDashboard(result);
  const priorities = dashboard.priorities.map((issue, index) => {
    const typeTarget = issue.changeType && issue.target ? ` [${issue.changeType} / ${issue.target}]` : "";
    return [
    `${index + 1}. [${issue.category.toUpperCase()}] ${issue.message}${typeTarget}`,
    `Suggested fix: ${issue.suggestedFixes[0] || "Review the linked source and rules, then run the review again."}`,
  ].join("\n");
  });

  return [
    "Prompt Quality Review - Priority Fixes",
    ...(priorities.length ? priorities : ["No priority fixes."]),
  ].join("\n\n");
}

export function formatFixChecklist(result: PromptReviewResult): string {
  const dashboard = buildPromptReviewDashboard(result);
  const checklist = dashboard.issues.map((issue, index) => {
    const typeTarget = issue.changeType && issue.target ? ` [${issue.changeType} / ${issue.target}]` : "";
    return [
    `[ ] ${index + 1}. ${issue.message}${typeTarget}`,
    `Where to fix: ${issue.guidance.likelySourceSection} (${issue.guidance.confidence} confidence)`,
    `Why it matters: ${issue.guidance.reason}`,
    `Suggested edit: ${issue.guidance.suggestedEditGuidance}`,
  ].join("\n");
  });

  return [
    "Prompt Quality Review - Fix Checklist",
    ...(checklist.length ? checklist : ["No fixes required."]),
  ].join("\n\n");
}

export function formatFullReview(
  result: PromptReviewResult,
  comparison?: PromptReviewComparison | null
): string {
  const dashboard = buildPromptReviewDashboard(result);
  const detailed = dashboard.issues.map((issue) => [
    `[${issue.category.toUpperCase()}] ${issue.message}`,
    `Sources: ${issue.sources.join(", ")}`,
    `Where to fix: ${issue.guidance.likelySourceSection} (${issue.guidance.confidence} confidence)`,
    `Why it matters: ${issue.guidance.reason}`,
    `Suggested edit: ${issue.guidance.suggestedEditGuidance}`,
    ...issue.suggestedFixes.map((fix) => `Suggested fix: ${fix}`),
  ].join("\n"));
  const dimensions = Object.entries(result.dimensionScores)
    .map(([dimension, score]) => `- ${dimension}: ${score}/100`);

  return [
    formatExecutiveReviewSummary(result),
    "",
    formatPriorityFixes(result),
    "",
    "Score Breakdown",
    ...dimensions,
    "",
    "Detailed Findings",
    ...(detailed.length ? detailed : ["No detailed findings."]),
    "",
    formatAgentResults(result),
    ...(comparison ? ["", formatReviewComparison(comparison)] : []),
  ].join("\n");
}
