import type { BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import type { GeneratedContentCategory } from "../../../lib/prompt-builder/project-generated-content-api";
import { useEffect, useRef } from "react";
import type { PromptBuilderController } from "../controllers/prompt-builder-view";

export function SourceEditorSection({ controller }: { controller: PromptBuilderController }) {
  const { brandLogoAssets, editableMarkdown, editableProjectFooter, editableProjectHeader, editableProjectLogoNotes, firstLogoAssetPath, handleSaveContentSource, handleSaveProjectChrome, isContentDirty, localWritesAvailable, logoNotesFromMarkdown, logoPreviewPath, projectFooterSource, projectHeaderSource, projectLogoSource, selectedContentEntry, selectedProjectLogoAsset, setEditableMarkdown, setEditableProjectFooter, setEditableProjectHeader, setEditableProjectLogoNotes, setSelectedProjectLogoAsset, workflowMode, sourceEditorTarget } = controller;
  const sourceEditorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!sourceEditorTarget || !sourceEditorRef.current) return;
    const textarea = sourceEditorRef.current;
    textarea.focus();
    if (sourceEditorTarget.range) {
      textarea.setSelectionRange(sourceEditorTarget.range.start, sourceEditorTarget.range.end);
      const beforeText = editableMarkdown.slice(0, sourceEditorTarget.range.start);
      const lineNumber = beforeText.split("\n").length;
      const lineHeight = 20;
      textarea.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
    } else {
      textarea.setSelectionRange(editableMarkdown.length, editableMarkdown.length);
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [sourceEditorTarget, editableMarkdown]);

  return <>
        {workflowMode === "create" && (
        <section className="panel editor-panel">
          <div className="project-chrome-editor">
            <div className="panel-title panel-title-row compact-panel-title">
              <div>
                <h2>Project Chrome</h2>
                <p>Header, footer and logo rules used before content-level overrides.</p>
              </div>
            </div>
            <div className="project-chrome-grid">
              <div className="chrome-card">
                <div className="chrome-card-header">
                  <span>Header markdown</span>
                  <div className="mini-actions">
                    <button className="quiet-button" type="button" onClick={() => setEditableProjectHeader(projectHeaderSource)}>Reset</button>
                    <button className="secondary-button compact-button" type="button" disabled={!localWritesAvailable} onClick={() => handleSaveProjectChrome("header")}>Save</button>
                  </div>
                </div>
                <textarea value={editableProjectHeader} onChange={(event) => setEditableProjectHeader(event.target.value)} spellCheck={false} />
              </div>

              <div className="chrome-card">
                <div className="chrome-card-header">
                  <span>Footer markdown</span>
                  <div className="mini-actions">
                    <button className="quiet-button" type="button" onClick={() => setEditableProjectFooter(projectFooterSource)}>Reset</button>
                    <button className="secondary-button compact-button" type="button" disabled={!localWritesAvailable} onClick={() => handleSaveProjectChrome("footer")}>Save</button>
                  </div>
                </div>
                <textarea value={editableProjectFooter} onChange={(event) => setEditableProjectFooter(event.target.value)} spellCheck={false} />
              </div>

              <div className="chrome-card project-logo-picker">
                <div className="chrome-card-header">
                  <span>Logo asset</span>
                  <div className="mini-actions">
                    <button className="quiet-button" type="button" onClick={() => {
                      const source = projectLogoSource;
                      setSelectedProjectLogoAsset(firstLogoAssetPath(source) || brandLogoAssets[0]?.path || "");
                      setEditableProjectLogoNotes(logoNotesFromMarkdown(source));
                    }}>Reset</button>
                    <button className="secondary-button compact-button" type="button" disabled={!localWritesAvailable} onClick={() => handleSaveProjectChrome("logo")}>Save</button>
                  </div>
                </div>
                <select value={selectedProjectLogoAsset} onChange={(event) => setSelectedProjectLogoAsset(event.target.value)}>
                  {brandLogoAssets.map((asset) => (
                    <option key={asset.path} value={asset.path}>
                      {asset.filename} ({asset.extension.toUpperCase()})
                    </option>
                  ))}
                </select>
                <div className="logo-choice-preview">
                  <img
                    src={brandLogoAssets.find((asset) => asset.path === selectedProjectLogoAsset)?.previewPath || logoPreviewPath}
                    alt="Selected project logo"
                  />
                  <code>{selectedProjectLogoAsset || "No logo asset selected"}</code>
                </div>
                <textarea
                  value={editableProjectLogoNotes}
                  onChange={(event) => setEditableProjectLogoNotes(event.target.value)}
                  spellCheck={false}
                  placeholder="Optional logo usage notes for this project."
                />
              </div>
            </div>
          </div>

          <div className="project-chrome-editor">
            <div className="panel-title panel-title-row compact-panel-title">
              <div>
                <h2>Editable Content Source</h2>
                <p>Edit the selected Markdown source before compiling prompts or running exports.</p>
              </div>
              <div className="mini-actions">
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => setEditableMarkdown(selectedContentEntry?.raw || "")}
                >
                  Reset
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  disabled={!localWritesAvailable || !selectedContentEntry}
                  onClick={handleSaveContentSource}
                >
                  Save
                </button>
              </div>
            </div>
            <div className="project-chrome-grid content-source-grid">
              <div className="chrome-card content-source-card">
                <div className="chrome-card-header">
                  <span>{selectedContentEntry?.filename || "No source file selected"}</span>
                  <small>{isContentDirty ? "Unsaved changes" : "Saved"}</small>
                </div>
                <textarea
                  ref={sourceEditorRef}
                  className="content-source-textarea"
                  value={editableMarkdown}
                  onChange={(event) => setEditableMarkdown(event.target.value)}
                  spellCheck={false}
                  placeholder="Select a content source to edit."
                />
              </div>
            </div>
          </div>
        </section>
        )}

  </>;
}
