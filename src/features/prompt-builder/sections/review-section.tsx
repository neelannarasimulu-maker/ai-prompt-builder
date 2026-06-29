import type { BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import type { GeneratedContentCategory } from "../../../lib/prompt-builder/project-generated-content-api";
import type { PromptBuilderController } from "../controllers/prompt-builder-view";
import { GeneratedContentSection } from "./generated-content-section";
import { PromptQualityReviewPanel } from "../prompt-quality-review-panel";
import {
  formatExecutiveReviewSummary,
  formatFixChecklist,
  formatFullReview,
  formatPriorityFixes,
  formatReviewComparison,
} from "../prompt-review-copy";

export function ReviewSection({ controller }: { controller: PromptBuilderController }) {
  const { clearPromptReviewSnapshots, copyToClipboard, promptReviewComparison, promptReviewPreviousSnapshot, promptReviewEnabled, promptReviewResult, refreshGeneratedFiles, savePromptReviewSnapshot, setPromptReviewEnabled, workflowMode, editableMarkdown } = controller;
  return <>
        {workflowMode === "review" && (
        <section className="panel generated-panel">
          <div className="panel-title panel-title-row">
            <div>
              <h2>Generated Content Review</h2>
              <p>Inspect and approve generated files for this project.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => refreshGeneratedFiles(true)}>Refresh files</button>
          </div>

          <div className="status-card review-toggle-card">
            <div className="review-toggle-row">
              <div>
                <h3>Prompt Quality Review</h3>
                <p>Enable deterministic advisory review for the current prompt.</p>
              </div>
              <label className="review-toggle-switch">
                <input
                  type="checkbox"
                  checked={promptReviewEnabled}
                  onChange={(event) => setPromptReviewEnabled(event.target.checked)}
                />
                <span>{promptReviewEnabled ? "On" : "Off"}</span>
              </label>
            </div>
          </div>

          <PromptQualityReviewPanel
            enabled={promptReviewEnabled}
            result={promptReviewResult}
            onCopyExecutiveSummary={() => {
              if (promptReviewResult) void copyToClipboard(formatExecutiveReviewSummary(promptReviewResult), "Executive summary");
            }}
            onCopyPriorityFixes={() => {
              if (promptReviewResult) void copyToClipboard(formatPriorityFixes(promptReviewResult), "Priority fixes");
            }}
            onCopyFullReview={() => {
              if (promptReviewResult) void copyToClipboard(formatFullReview(promptReviewResult, promptReviewComparison), "Full review");
            }}
            onCopyFixChecklist={() => {
              if (promptReviewResult) void copyToClipboard(formatFixChecklist(promptReviewResult), "Fix checklist");
            }}
            onCopyComparison={() => {
              if (promptReviewComparison) void copyToClipboard(formatReviewComparison(promptReviewComparison), "Review comparison");
            }}
            onGoToSourceSection={(issue) => controller.goToSourceSection(issue)}
            onCopySuggestedEdit={(issue) => {
              const text = controller.formatSuggestedEditText(issue);
              void controller.copyToClipboard(text, "Suggested edit");
              controller.markFixStatus(issue.id, "copied");
            }}
            onRequestApplySourceEdit={(issue) => {
              const succeeded = controller.confirmSourceEdit(issue);
              if (succeeded) {
                controller.markFixStatus(issue.id, "applied");
              }
              return succeeded;
            }}
            editableMarkdown={editableMarkdown}
            onDismissFix={(issue) => controller.markFixStatus(issue.id, "dismissed")}
            getFixStatus={(issueId) => controller.getFixStatus(issueId)}
            previewForIssue={controller.previewForIssue}
            shouldApplyMissingSection={controller.shouldApplyMissingSection}
            showNonTrivialCopyOnly={controller.showNonTrivialCopyOnly}
            previousSnapshot={promptReviewPreviousSnapshot}
            comparison={promptReviewComparison}
            onSaveSnapshot={savePromptReviewSnapshot}
            onClearSnapshots={clearPromptReviewSnapshots}
          />
          <GeneratedContentSection controller={controller} />
        </section>
        )}
        {workflowMode === "export" && (
        <section className="panel generated-panel">
          <div className="panel-title panel-title-row">
            <div>
              <h2>Export Selection</h2>
              <p>Select generated files for the delivery pack.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => refreshGeneratedFiles(true)}>Refresh files</button>
          </div>

          <GeneratedContentSection controller={controller} />
        </section>
        )}

  </>;
}
