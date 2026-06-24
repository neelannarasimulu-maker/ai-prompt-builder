import type { BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import type { GeneratedContentCategory } from "../../../lib/prompt-builder/project-generated-content-api";
import type { PromptBuilderController } from "../controllers/prompt-builder-view";

export function PromptActionsSection({ controller }: { controller: PromptBuilderController }) {
  const { compiled, copyToClipboard, handleCopyLinkedInPostText, handleCopyLogoFile, handleCopyOutputFilename, handleCopySourceMarkdownFile, handleRenderLockedDocument, isDocumentLike, isRenderingDocument, localWritesAvailable, resolvedLogoAssetPath, selectedContentEntry, selectedContentType, selectedOutputProfile, workflowMode } = controller;
  return <>
<div className="action-strip streamlined-actions">
            <button className="primary-button" type="button" onClick={() => copyToClipboard(compiled.productionPrompt, "Prompt")}>Copy prompt</button>
            {workflowMode === "run" && (
              <button className="secondary-button" type="button" disabled={!localWritesAvailable || !resolvedLogoAssetPath} onClick={handleCopyLogoFile}>Copy logo</button>
            )}
            {workflowMode === "run" && (
              <button className="secondary-button" type="button" disabled={!localWritesAvailable || !selectedContentEntry} onClick={handleCopySourceMarkdownFile}>
                {isDocumentLike ? "Copy document MD" : "Copy visual MD"}
              </button>
            )}
            {workflowMode === "run" && (
              <button className="secondary-button" type="button" onClick={handleCopyOutputFilename}>Copy Filename</button>
            )}
            {workflowMode === "run" && isDocumentLike && (
              <button className="secondary-button" type="button" disabled={!localWritesAvailable || isRenderingDocument} onClick={handleRenderLockedDocument}>
                {isRenderingDocument ? "RenderingÃ¢â‚¬Â¦" : `Render locked ${selectedOutputProfile.outputType === "pdf" ? "PDF" : "Word document"}`}
              </button>
            )}
            {selectedContentType === "linkedin" && compiled.promptPreview.linkedinPostText?.trim() && (
              <button className="secondary-button" type="button" onClick={handleCopyLinkedInPostText}>Copy LinkedIn Post Text</button>
            )}
          </div>
  </>;
}
