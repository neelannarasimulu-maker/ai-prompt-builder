import { useMemo, useState } from "react";
import type { PromptReviewResult } from "../../review/prompt-review-types";
import { buildPromptReviewDashboard } from "../../review/prompt-review-dashboard";
import type {
  PromptReviewComparison,
  PromptReviewSnapshot,
} from "../../review/prompt-review-snapshots";
import type { ReviewDashboardIssue } from "../../review/prompt-review-dashboard";

export type FixStatus = "open" | "copied" | "applied" | "dismissed";

type ReviewPanelProps = {
  enabled: boolean;
  result: PromptReviewResult | null;
  previousSnapshot?: PromptReviewSnapshot | null;
  comparison?: PromptReviewComparison | null;
  editableMarkdown: string;
  onCopyExecutiveSummary?: () => void;
  onCopyPriorityFixes?: () => void;
  onCopyFullReview?: () => void;
  onCopyFixChecklist?: () => void;
  onSaveSnapshot?: () => void;
  onClearSnapshots?: () => void;
  onCopyComparison?: () => void;
  onGoToSourceSection?: (issue: ReviewDashboardIssue) => void;
  onCopySuggestedEdit?: (issue: ReviewDashboardIssue) => void;
  onRequestApplySourceEdit?: (issue: ReviewDashboardIssue) => boolean;
  onDismissFix?: (issue: ReviewDashboardIssue) => void;
  getFixStatus?: (issueId: string) => FixStatus;
  previewForIssue?: (issue: ReviewDashboardIssue) => { oldText: string; newText: string } | null;
  shouldApplyMissingSection?: (issue: ReviewDashboardIssue, markdown: string) => boolean;
  showNonTrivialCopyOnly?: (issue: ReviewDashboardIssue, markdown: string) => boolean;
};

function delta(value: number | null): string {
  if (value === null) return "N/A";
  return value > 0 ? `+${value}` : String(value);
}

function dimensionLabel(value: string): string {
  return value.replace(/^(?:evaluator|skill):/, "").replace(/-/g, " ");
}

export function PromptQualityReviewPanel({
  enabled,
  result,
  previousSnapshot,
  comparison,
  editableMarkdown,
  onCopyExecutiveSummary,
  onCopyPriorityFixes,
  onCopyFullReview,
  onCopyFixChecklist,
  onSaveSnapshot,
  onClearSnapshots,
  onCopyComparison,
  onGoToSourceSection,
  onCopySuggestedEdit,
  onRequestApplySourceEdit,
  onDismissFix,
  getFixStatus,
  previewForIssue,
  shouldApplyMissingSection,
  showNonTrivialCopyOnly,
}: ReviewPanelProps) {
  const [previewIssue, setPreviewIssue] = useState<ReviewDashboardIssue | null>(null);
  const [previewData, setPreviewData] = useState<{ oldText: string; newText: string } | null>(null);

  if (!enabled) return null;
  if (!result) {
    return <section className="review-dashboard status-card">Review is enabled, but the current prompt is not ready for review.</section>;
  }

  const dashboard = buildPromptReviewDashboard(result);

  function beginApplyPreview(issue: ReviewDashboardIssue) {
    if (!previewForIssue) return;
    const preview = previewForIssue(issue);
    if (!preview) return;
    setPreviewIssue(issue);
    setPreviewData(preview);
  }

  function closePreview() {
    setPreviewIssue(null);
    setPreviewData(null);
  }

  function handleConfirmApply() {
    if (!previewIssue || !onRequestApplySourceEdit) return;
    onRequestApplySourceEdit(previewIssue);
    closePreview();
  }

  return (
    <section className="review-dashboard" aria-label="Prompt Quality Review">
      <section className="review-summary-card">
        <div>
          <p className="eyebrow">Prompt Quality Review</p>
          <div className="review-score-line">
            <strong>{result.overallScore}</strong><span>/100</span>
            <span className={`review-status review-status-${dashboard.status.toLowerCase().replace(/\s/g, "-")}`}>
              {dashboard.status}
            </span>
          </div>
          <p>Deterministic advisory review. Your prompt is never changed automatically.</p>
        </div>
        <div className="review-summary-actions">
          <button className="primary-button compact-button" type="button" onClick={onCopyExecutiveSummary}>Copy executive summary</button>
          <button className="secondary-button compact-button" type="button" onClick={onCopyPriorityFixes}>Copy priority fixes</button>
          <button className="secondary-button compact-button" type="button" onClick={onCopyFullReview}>Copy full review</button>
          <button className="secondary-button compact-button" type="button" onClick={onCopyFixChecklist}>Copy fix checklist</button>
        </div>
        <div className="review-count-grid">
          <div className="review-severity-blocking"><strong>{dashboard.counts.blocking}</strong><span>Blocking</span></div>
          <div className="review-severity-warning"><strong>{dashboard.counts.warning}</strong><span>Warnings</span></div>
          <div className="review-severity-suggestion"><strong>{dashboard.counts.suggestion}</strong><span>Suggestions</span></div>
          <div className="review-severity-passed"><strong>{dashboard.counts.passed}</strong><span>Agents passed</span></div>
        </div>
      </section>

      <section className="review-section-card">
        <div className="review-section-heading"><span>01</span><div><h3>Priority Fixes</h3><p>Start here. These are the three highest-impact issues.</p></div></div>
        {dashboard.priorities.length > 0 ? (
          <div className="review-priority-list">
            {dashboard.priorities.map((issue, index) => {
              const fixStatus = getFixStatus?.(issue.id) ?? "open";
              const canApply = shouldApplyMissingSection?.(issue, editableMarkdown) ?? false;
              const copyOnly = showNonTrivialCopyOnly?.(issue, editableMarkdown) ?? true;
              return (
                <article className={`review-priority review-severity-${issue.category}`} key={issue.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{issue.message}</strong>
                    {issue.changeType && issue.target && (
                      <div className="review-change-type">
                        <span className={`change-type-badge change-type-${issue.changeType.toLowerCase().replace(/\s/g, "-")}`}>{issue.changeType}</span>
                        <span className="change-target">{issue.target}</span>
                      </div>
                    )}
                    <div className="review-guidance">
                      <p><span>Where to fix</span><strong>{issue.guidance.likelySourceSection}</strong><small>{issue.guidance.confidence} confidence</small></p>
                      <p><span>Why it matters</span>{issue.guidance.reason}</p>
                      <p><span>Suggested edit</span>{issue.guidance.suggestedEditGuidance}</p>
                    </div>
                    <div className="review-priority-actions">
                      <button className="secondary-button compact-button" type="button" onClick={() => onGoToSourceSection?.(issue)}>Go to source section</button>
                      {copyOnly ? (
                        <button className="secondary-button compact-button" type="button" onClick={() => onCopySuggestedEdit?.(issue)}>Copy suggested edit</button>
                      ) : (
                        <button className="secondary-button compact-button" type="button" onClick={() => beginApplyPreview(issue)}>Insert missing section</button>
                      )}
                      <button className="quiet-button compact-button" type="button" onClick={() => onDismissFix?.(issue)}>Dismiss</button>
                      <span className={`fix-status fix-status-${fixStatus}`}>{fixStatus}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p className="status-ok">No priority fixes. This prompt is ready.</p>}
      </section>

      {previewData && previewIssue ? (
        <section className="review-section-card review-preview-card">
          <div className="review-section-heading"><span>02</span><div><h3>Preview source edit</h3><p>Review the proposed safe source insertion before applying.</p></div></div>
          <div className="review-preview-content">
            <div className="review-preview-block">
              <h4>Current source</h4>
              <textarea readOnly value={previewData.oldText} spellCheck={false} />
            </div>
            <div className="review-preview-block">
              <h4>Proposed source</h4>
              <textarea readOnly value={previewData.newText} spellCheck={false} />
            </div>
          </div>
          <div className="button-row review-preview-actions">
            <button className="secondary-button compact-button" type="button" onClick={closePreview}>Cancel</button>
            <button className="primary-button compact-button" type="button" onClick={handleConfirmApply}>Apply source edit</button>
          </div>
        </section>
      ) : null}

      <section className="review-section-card">
        <div className="review-section-heading"><span>02</span><div><h3>Agent Results</h3><p>Compact specialist assessments with full details on demand.</p></div></div>
        <div className="review-agent-grid">
          {result.agentRuns.map((agent) => {
            const isRemediation = agent.id === "remediation-advisor-agent";
            const metric = isRemediation
              ? `${agent.recommendations.length} suggested fixes`
              : `${agent.score}/100`;
            return (
              <details className={`review-agent-card review-severity-${agent.status === "passed" ? "passed" : agent.status === "blocked" ? "blocking" : "warning"}`} key={agent.id}>
                <summary>
                  <div><strong>{agent.name}</strong><span>{agent.result}</span></div>
                  <div><span className="review-agent-status">{agent.status}</span><strong>{metric}</strong></div>
                </summary>
                <div className="review-agent-details">
                  <p>{agent.description}</p>
                  <p><strong>Skills:</strong> {agent.skillsUsed.join(", ") || "None"}</p>
                  <h4>Findings</h4>
                  {agent.findings.length ? <ul>{agent.findings.map((finding, index) => <li key={`${agent.id}-finding-${index}`}>{finding.message}</li>)}</ul> : <p className="status-ok">No findings.</p>}
                  <h4>Recommendations</h4>
                  {agent.recommendations.length ? <ul>{agent.recommendations.map((recommendation, index) => <li key={`${agent.id}-recommendation-${index}`}>{recommendation}</li>)}</ul> : <p className="status-ok">No recommendations.</p>}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="review-section-card">
        <div className="review-section-heading"><span>03</span><div><h3>Score Breakdown</h3><p>Evaluator and skill dimensions contributing to the overall score.</p></div></div>
        <div className="review-score-grid">
          {Object.entries(result.dimensionScores).map(([dimension, score]) => (
            <div key={dimension}><span>{dimensionLabel(dimension)}</span><strong>{score}</strong><small>/100</small></div>
          ))}
        </div>
      </section>

      <section className="review-section-card">
        <div className="review-section-heading"><span>04</span><div><h3>Detailed Findings</h3><p>De-duplicated issues with every contributing source retained.</p></div></div>
        {dashboard.issues.length ? (
          <div className="review-finding-list">
            {dashboard.issues.map((issue) => (
              <article className={`review-finding review-severity-${issue.category}`} key={issue.id}>
                <div><span>{issue.category}</span><strong>{issue.message}</strong></div>
                {issue.changeType && issue.target && (
                  <div className="review-change-type-compact">
                    <span className={`change-type-badge change-type-${issue.changeType.toLowerCase().replace(/\s/g, "-")}`}>{issue.changeType}</span>
                    <span className="change-target">{issue.target}</span>
                  </div>
                )}
                <small>Sources: {issue.sources.join(", ")}</small>
                <div className="review-guidance review-guidance-compact">
                  <p><span>Where to fix</span><strong>{issue.guidance.likelySourceSection}</strong><small>{issue.guidance.confidence} confidence</small></p>
                  <p><span>Why it matters</span>{issue.guidance.reason}</p>
                  <p><span>Suggested edit</span>{issue.guidance.suggestedEditGuidance}</p>
                </div>
                {issue.suggestedFixes.map((fix) => <p key={fix}>{fix}</p>)}
              </article>
            ))}
          </div>
        ) : <p className="status-ok">No detailed findings.</p>}
      </section>

      <section className="review-section-card">
        <div className="review-section-heading"><span>05</span><div><h3>Snapshots &amp; Comparison</h3><p>Measure quality changes after manual source edits.</p></div></div>
        <div className="button-row">
          <button className="secondary-button compact-button" type="button" onClick={onSaveSnapshot}>Save review snapshot</button>
          <button className="quiet-button compact-button" type="button" disabled={!previousSnapshot} onClick={onClearSnapshots}>Clear snapshots</button>
          <button className="secondary-button compact-button" type="button" disabled={!previousSnapshot || !comparison} onClick={onCopyComparison}>Copy comparison summary</button>
        </div>
        {comparison && previousSnapshot ? (
          <div className="review-comparison-grid">
            <div><span>Current score</span><strong>{comparison.currentScore}/100</strong></div>
            <div><span>Previous score</span><strong>{comparison.previousScore}/100</strong></div>
            <div><span>Score delta</span><strong>{delta(comparison.scoreDelta)}</strong></div>
            <div><span>Finding delta</span><strong>{delta(comparison.findingCountDelta)}</strong></div>
            <div><span>Fix delta</span><strong>{delta(comparison.suggestedFixCountDelta)}</strong></div>
          </div>
        ) : <p>No saved snapshot for this prompt yet.</p>}
      </section>
    </section>
  );
}
