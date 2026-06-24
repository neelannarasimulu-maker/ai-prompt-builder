import type { PromptReviewResult } from "./prompt-review-types";
import { createSourceFixGuidance, type SourceFixGuidance } from "./prompt-source-guidance";

export type ReviewDashboardStatus = "Ready" | "Needs Review" | "Needs Fixes";

export type ReviewDashboardIssue = {
  id: string;
  code: string;
  message: string;
  category: "blocking" | "warning" | "suggestion";
  sources: string[];
  suggestedFixes: string[];
  guidance: SourceFixGuidance;
};

export type ReviewDashboardModel = {
  status: ReviewDashboardStatus;
  issues: ReviewDashboardIssue[];
  priorities: ReviewDashboardIssue[];
  counts: {
    blocking: number;
    warning: number;
    suggestion: number;
    passed: number;
  };
};

const codeAliases: Record<string, string> = {
  "missing-logo-asset": "missing-logo",
  "missing-logo": "missing-logo",
  "missing-body-content": "missing-source-content",
  "missing-document-source": "missing-source-content",
  "missing-visible-text": "missing-visible-text",
};

const categoryRank = {
  blocking: 3,
  warning: 2,
  suggestion: 1,
} as const;

function canonicalCode(code: string): string {
  return codeAliases[code] ?? code;
}

function issueKey(code: string, message: string): string {
  const canonical = canonicalCode(code);
  if (codeAliases[code]) return canonical;
  return `${canonical}:${message.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export function buildPromptReviewDashboard(result: PromptReviewResult): ReviewDashboardModel {
  const issueMap = new Map<string, ReviewDashboardIssue>();
  const allFindings = [
    ...result.findings,
    ...result.agentRuns.flatMap((agent) => agent.findings),
  ];

  for (const finding of allFindings) {
    const key = issueKey(finding.code, finding.message);
    const existing = issueMap.get(key);
    if (existing) {
      if (!existing.sources.includes(finding.source)) existing.sources.push(finding.source);
      if (categoryRank[finding.category] > categoryRank[existing.category]) {
        existing.category = finding.category;
      }
      continue;
    }

    const issue = {
      id: key,
      code: canonicalCode(finding.code),
      message: finding.message,
      category: finding.category,
      sources: [finding.source],
      suggestedFixes: [],
    };
    issueMap.set(key, { ...issue, guidance: createSourceFixGuidance(issue) });
  }

  for (const suggestion of result.remediationSuggestions) {
    const canonical = canonicalCode(suggestion.findingCode);
    const issue = Array.from(issueMap.values()).find((candidate) =>
      candidate.code === canonical &&
      (candidate.sources.includes(suggestion.source) || candidate.suggestedFixes.length === 0)
    );
    if (issue && !issue.suggestedFixes.includes(suggestion.suggestedFix)) {
      issue.suggestedFixes.push(suggestion.suggestedFix);
    }
  }

  const issues = Array.from(issueMap.values())
    .map((issue) => ({ ...issue, guidance: createSourceFixGuidance(issue) }))
    .sort((a, b) => categoryRank[b.category] - categoryRank[a.category]);
  const blocking = issues.filter((issue) => issue.category === "blocking").length;
  const warning = issues.filter((issue) => issue.category === "warning").length;
  const suggestion = issues.filter((issue) => issue.category === "suggestion").length;
  const passed = result.agentRuns.filter((agent) => agent.status === "passed").length;
  const status: ReviewDashboardStatus = blocking > 0 || result.overallScore < 60
    ? "Needs Fixes"
    : warning > 0 || suggestion > 0 || result.overallScore < 85
      ? "Needs Review"
      : "Ready";

  return {
    status,
    issues,
    priorities: issues.slice(0, 3),
    counts: { blocking, warning, suggestion, passed },
  };
}
