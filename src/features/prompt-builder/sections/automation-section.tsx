import type { BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import type { GeneratedContentCategory } from "../../../lib/prompt-builder/project-generated-content-api";
import type { PromptBuilderController } from "../controllers/prompt-builder-view";

export function AutomationSection({ controller }: { controller: PromptBuilderController }) {
  const { AutomationPanel, assistChatGptOpened, assistCopiedFilename, assistCopiedPrompt, assistError, assistRunStartedAt, assistSavedFile, assistTargetVersion, assistUploadFile, compiled, customOutputFilename, handleAssistCopyFilename, handleAssistCopyPrompt, handleAssistManualUpload, handleImportLatestChatGptDownload, handleOpenChatGptAssist, isAssistModalOpen, isImportingAssistDownload, localWritesAvailable, logoPreviewPath, masterFrameMetadata, normalizeAssistImageFilename, normalizeAssistVersionLabel, refreshGeneratedFiles, selectedBrand, selectedContentEntry, selectedProject, selectedProjectLogoAsset, setAssistTargetVersion, setAssistUploadFile, setIsAssistModalOpen, suggestedOutputFilename, validateAssistImportInput, versionOptions } = controller;
  return <>
      {isAssistModalOpen && (
        <AutomationPanel>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Normal Chrome assisted mode</p>
                <h2 id="assist-modal-title">Run ChatGPT Assistant</h2>
                <p>Use your logged-in ChatGPT tab. This assistant prepares the prompt and filename, then imports the downloaded image into the selected content set's version folder.</p>
              </div>
              <button className="quiet-button" type="button" onClick={() => setIsAssistModalOpen(false)}>Close</button>
            </div>

            <div className="automation-summary-grid">
              <div>
                <span>Brand / Project</span>
                <strong>{selectedBrand?.label || "None"} / {selectedProject?.label || "None"}</strong>
              </div>
              <div>
                <span>Current visual</span>
                <strong>{selectedContentEntry?.label || "None"}</strong>
              </div>
              <div>
                <span>Output filename</span>
                <strong>{normalizeAssistImageFilename(customOutputFilename || suggestedOutputFilename)}</strong>
              </div>
              <label className="field">
                <span>Target version folder</span>
                <select value={assistTargetVersion} onChange={(event) => setAssistTargetVersion(normalizeAssistVersionLabel(event.target.value))}>
                  {Array.from(new Set([assistTargetVersion || "v001", "v001", ...versionOptions.filter((version) => version !== "Unversioned")])).map((version) => (
                    <option key={version} value={version}>{version}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="automation-logo-row">
              <div className="logo-stage">
                <img src={logoPreviewPath} alt="Resolved automation logo" />
              </div>
              <div>
                <span>App-rendered master-frame logo</span>
                <code>{compiled.promptPreview.logoAsset || selectedProjectLogoAsset || selectedBrand?.logoAsset || "No logo asset"}</code>
              </div>
            </div>

            <div className="automation-preflight">
              {validateAssistImportInput({
                projectFolder: selectedProject?.folder,
                outputFilename: customOutputFilename || suggestedOutputFilename,
                versionLabel: assistTargetVersion,
                runStartedAt: assistRunStartedAt,
                masterFrame: masterFrameMetadata,
              }).length === 0 ? (
                <p className="status-ok">Ready. Downloaded images after {assistRunStartedAt ? new Date(assistRunStartedAt).toLocaleTimeString() : "this run starts"} can be imported from Downloads.</p>
              ) : (
                <ul>
                  {validateAssistImportInput({
                    projectFolder: selectedProject?.folder,
                    outputFilename: customOutputFilename || suggestedOutputFilename,
                    versionLabel: assistTargetVersion,
                    runStartedAt: assistRunStartedAt,
                    masterFrame: masterFrameMetadata,
                  }).map((error) => <li key={error}>{error}</li>)}
                </ul>
              )}
            </div>

            <div className="automation-steps">
              <div className={`automation-step step-${assistCopiedPrompt ? "complete" : "queued"}`}>
                <span>{assistCopiedPrompt ? "complete" : "queued"}</span>
                <strong>Copy prompt</strong>
                <p>Paste this prompt into your logged-in ChatGPT tab.</p>
              </div>
              <div className={`automation-step step-${assistCopiedFilename ? "complete" : "queued"}`}>
                <span>{assistCopiedFilename ? "complete" : "queued"}</span>
                <strong>Copy filename</strong>
                <p>Copied filename excludes the extension, matching the app filename rule.</p>
              </div>
              <div className={`automation-step step-${assistChatGptOpened ? "complete" : "queued"}`}>
                <span>{assistChatGptOpened ? "complete" : "queued"}</span>
                <strong>Open ChatGPT</strong>
                <p>Generate and download body artwork only. Do not attach the logo; the app adds it in the locked frame.</p>
              </div>
              <div className={`automation-step step-${assistSavedFile?.ok ? "complete" : isImportingAssistDownload ? "running" : "queued"}`}>
                <span>{assistSavedFile?.ok ? "complete" : isImportingAssistDownload ? "running" : "queued"}</span>
                <strong>Import downloaded image</strong>
                <p>The app fits the newest downloaded artwork into the fixed body area, then renders the header, footer and real logo.</p>
              </div>
            </div>

            {assistError && <div className="automation-error">{assistError}</div>}

            {assistSavedFile?.ok && (
              <div className="automation-saved">
                <div>
                  <span>Saved file</span>
                  <strong>{assistSavedFile.filename}</strong>
                  <code>{assistSavedFile.relativePath}</code>
                </div>
                {assistSavedFile.fileUrl && <a className="secondary-button" href={assistSavedFile.fileUrl} target="_blank" rel="noreferrer">Open saved file</a>}
              </div>
            )}

            <div className="modal-actions">
              <button className="primary-button" type="button" onClick={handleAssistCopyPrompt}>Copy prompt</button>
              <button className="secondary-button" type="button" onClick={handleAssistCopyFilename}>Copy filename</button>
              <a className="secondary-button" href={logoPreviewPath} target="_blank" rel="noreferrer">Open logo file</a>
              <button className="secondary-button" type="button" onClick={handleOpenChatGptAssist}>Open ChatGPT</button>
              <button className="primary-button" type="button" onClick={handleImportLatestChatGptDownload} disabled={!localWritesAvailable || isImportingAssistDownload}>
                {isImportingAssistDownload ? "Importing..." : "Import latest download"}
              </button>
              <button className="secondary-button" type="button" onClick={() => refreshGeneratedFiles(true)}>Refresh generated content</button>
            </div>

            <div className="automation-upload-fallback">
              <label className="field">
                <span>Manual upload fallback</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setAssistUploadFile(event.target.files?.[0] || null)}
                />
              </label>
              <button className="secondary-button" type="button" onClick={handleAssistManualUpload} disabled={!localWritesAvailable || !assistUploadFile}>
                Save to generated folder
              </button>
            </div>
        </AutomationPanel>
      )}


  </>;
}

