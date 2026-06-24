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
  const { clearPromptReviewSnapshots, copyToClipboard, promptReviewComparison, promptReviewPreviousSnapshot, promptReviewEnabled, promptReviewResult, refreshGeneratedFiles, savePromptReviewSnapshot, setPromptReviewEnabled, workflowMode } = controller;
  return <>
        {(workflowMode === "review" || workflowMode === "export") && (
        <section className="panel generated-panel">
          <div className="panel-title panel-title-row">
            <div>
              <h2>{workflowMode === "review" ? "Generated Content Review" : "Export Selection"}</h2>
              <p>{workflowMode === "review" ? "Inspect and approve generated files for this project." : "Select generated files for the delivery pack."}</p>
            </div>
            <button className="primary-button" type="button" onClick={() => refreshGeneratedFiles(true)}>Refresh files</button>
          </div>

          <div className="status-card">
            <label className="field">
              <span>Prompt Quality Review</span>
              <input
                type="checkbox"
                checked={promptReviewEnabled}
                onChange={(event) => setPromptReviewEnabled(event.target.checked)}
              />
            </label>
            <p>Enable deterministic advisory review for the current prompt.</p>
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
            previousSnapshot={promptReviewPreviousSnapshot}
            comparison={promptReviewComparison}
            onSaveSnapshot={savePromptReviewSnapshot}
            onClearSnapshots={clearPromptReviewSnapshots}
            onCopyComparison={() => {
              if (promptReviewComparison) void copyToClipboard(formatReviewComparison(promptReviewComparison), "Review comparison");
            }}
          />
          <GeneratedContentSection controller={controller} />
        </section>
        )}

  </>;
}
