import type { BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import type { GeneratedContentCategory } from "../../../lib/prompt-builder/project-generated-content-api";
import type { PromptBuilderController } from "../controllers/prompt-builder-view";
import { PromptActionsSection } from "./prompt-actions-section";

export function PromptPreviewSection({ controller }: { controller: PromptBuilderController }) {
  const { basenameWithoutExtension, compiled, customOutputFilename, handleDownloadDocumentMarkdownFile, isDocumentLike, outputPromptModeLabel, promptView, selectedContentType, selectedOutputProfile, setCustomOutputFilename, setPromptView, shownPrompt, suggestedOutputFilename, workflowMode } = controller;
  return <>
        {(workflowMode === "create" || workflowMode === "run") && (
        <section className="panel prompt-panel">
          <div className="panel-title panel-title-row">
            <div>
              <h2>{workflowMode === "create" ? "Prompt Preview" : "Run Prompt"}</h2>
              <p>{isDocumentLike ? "Render the production Word/PDF in the app for locked headers, footers and logo placement. Copy prompt remains available for direct ChatGPT fallback." : "Generate body artwork only; the app applies the locked master frame after download. Copy prompt remains available for direct ChatGPT use."}</p>
            </div>
            <div className="segmented-toggle">
              <button type="button" className={promptView === "production" ? "active" : ""} onClick={() => setPromptView("production")}>{outputPromptModeLabel(selectedOutputProfile?.outputType)}</button>
              <button type="button" className={promptView === "contract" ? "active" : ""} onClick={() => setPromptView("contract")}>Contract</button>
              <button type="button" className={promptView === "debug" ? "active" : ""} onClick={() => setPromptView("debug")}>Debug</button>
              <button type="button" className={promptView === "actions" ? "active" : ""} onClick={() => setPromptView("actions")}>Actions</button>
            </div>
          </div>

          <div className="output-name-card">
            <div className="output-name-main">
              <label className="field">
                <span>Suggested output filename</span>
                <input value={customOutputFilename} onChange={(e) => setCustomOutputFilename(e.target.value)} />
              </label>
              <p className="field-note">Copy uses basename only: {basenameWithoutExtension(customOutputFilename || suggestedOutputFilename)}</p>
            </div>
          </div>

          <PromptActionsSection controller={controller} />

          {isDocumentLike && (
            <div className="doc-workflow-card simplified-doc-workflow">
              <div>
                <strong>Document MD download</strong>
                <p>Download the source file when you need a saved fallback instead of copying it directly from the Run actions.</p>
              </div>

              <div className="doc-workflow-actions compact-actions">
                <button className="primary-button" type="button" onClick={handleDownloadDocumentMarkdownFile}>Download document MD</button>
              </div>
            </div>
          )}

          <div className="source-truth-preview">
            <div>
              <span>Detected sections</span>
              <pre>{compiled.promptPreview.detectedSections?.length ? compiled.promptPreview.detectedSections.join("\n") : "None"}</pre>
            </div>
            <div>
              <span>Ignored legacy sections</span>
              <pre>{compiled.promptPreview.ignoredLegacySections?.length ? compiled.promptPreview.ignoredLegacySections.join("\n") : "None"}</pre>
            </div>
            <div>
              <span>Resolved header</span>
              <pre>{compiled.promptPreview.headerText || "None"}</pre>
            </div>
            <div>
              <span>Resolved footer</span>
              <pre>{compiled.promptPreview.footerText || "None"}</pre>
            </div>
            <div>
              <span>Resolved logo</span>
              <pre>{compiled.promptPreview.logoAsset || "None"}</pre>
            </div>
            <div>
              <span>Background theme</span>
              <pre>{compiled.promptPreview.backgroundTheme || "None"}</pre>
            </div>
            <div>
              <span>Visible output text</span>
              <pre>{compiled.promptPreview.visibleText || "None"}</pre>
            </div>
            {selectedContentType === "linkedin" && (
              <div>
                <span>LinkedIn Post Text</span>
                <pre>{compiled.promptPreview.linkedinPostText || "None"}</pre>
              </div>
            )}
            {isDocumentLike && (
              <div>
                <span>Cover page source</span>
                <pre>{compiled.promptPreview.coverPageContent || "None"}</pre>
              </div>
            )}
            {isDocumentLike && (
              <div>
                <span>Table of contents</span>
                <pre>{compiled.promptPreview.tableOfContentsContent || "None"}</pre>
              </div>
            )}
            <div>
              <span>{isDocumentLike ? "Document body source" : "Guidance only"}</span>
              <pre>{(isDocumentLike ? compiled.promptPreview.bodyContent : compiled.promptPreview.guidance) || "None"}</pre>
            </div>
          </div>

          <textarea className="prompt-output" value={shownPrompt} readOnly spellCheck={false} />
        </section>
        )}


  </>;
}
