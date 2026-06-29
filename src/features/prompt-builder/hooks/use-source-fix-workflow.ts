import { useMemo, useState } from "react";
import type { ReviewDashboardIssue } from "../../../review/prompt-review-dashboard";
import { applyMissingSection, buildMissingSectionPreview, formatSuggestedEditText, shouldApplyMissingSection, showNonTrivialCopyOnly } from "../../../review/prompt-source-fixes";
import { parseMarkdownSectionList } from "../../../lib/prompt-builder/content-sections";
import type { WorkflowMode } from "../../../lib/prompt-builder/workflow-features";

export type SourceEditorTarget = {
  section: string;
  range?: { start: number; end: number };
};

export type FixStatus = "open" | "copied" | "applied" | "dismissed";

export function useSourceFixWorkflow(
  editableMarkdown: string,
  setEditableMarkdown: (value: string) => void,
  workflowMode: WorkflowMode,
  setWorkflowMode: (value: WorkflowMode) => void,
) {
  const [sourceEditorTarget, setSourceEditorTarget] = useState<SourceEditorTarget | null>(null);
  const [fixStatuses, setFixStatuses] = useState<Record<string, FixStatus>>({});

  const previewForIssue = useMemo(() => {
    return (issue: ReviewDashboardIssue) => buildMissingSectionPreview(issue, editableMarkdown);
  }, [editableMarkdown]);

  function goToSourceSection(issue: ReviewDashboardIssue) {
    const section = issue.guidance.likelySourceSection;
    const headings = parseMarkdownSectionList(editableMarkdown);
    const normalized = section.toLowerCase();
    const target = headings.find((heading) => heading.heading.toLowerCase() === normalized);

    if (target) {
      setSourceEditorTarget({
        section: target.heading,
        range: {
          start: editableMarkdown.indexOf(`## ${target.heading}`),
          end: editableMarkdown.indexOf(`## ${target.heading}`) + target.heading.length + 2,
        },
      });
      return;
    }

    setSourceEditorTarget({ section, range: undefined });
  }

  function confirmSourceEdit(issue: ReviewDashboardIssue) {
    const preview = buildMissingSectionPreview(issue, editableMarkdown);
    if (!preview) return false;
    const newText = applyMissingSection(issue, editableMarkdown);
    if (newText === editableMarkdown) return false;
    setEditableMarkdown(newText);
    return true;
  }

  function markFixStatus(issueId: string, status: FixStatus) {
    setFixStatuses((current) => ({ ...current, [issueId]: status }));
  }

  function getFixStatus(issueId: string): FixStatus {
    return fixStatuses[issueId] ?? "open";
  }

  return {
    sourceEditorTarget,
    goToSourceSection,
    confirmSourceEdit,
    markFixStatus,
    getFixStatus,
    previewForIssue,
    shouldApplyMissingSection,
    showNonTrivialCopyOnly,
    formatSuggestedEditText,
  };
}
