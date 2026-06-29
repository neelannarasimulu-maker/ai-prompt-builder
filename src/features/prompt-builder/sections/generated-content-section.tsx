import type { BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import type { GeneratedContentCategory } from "../../../lib/prompt-builder/project-generated-content-api";
import type { PromptBuilderController } from "../controllers/prompt-builder-view";

export function GeneratedContentSection({ controller }: { controller: PromptBuilderController }) {
  const { basenameWithoutExtension, categoryLabel, filePreviewTitle, filteredGeneratedFiles, formatFileSize, generatedContentCategories, generatedSearch, selectedGeneratedCategory, selectedGeneratedFile, selectedGeneratedFileIds, selectedGeneratedVersion, selectedProject, setDistributionPrefill, setGeneratedSearch, setSelectedGeneratedCategory, setSelectedGeneratedFileId, setSelectedGeneratedVersion, setWorkflowMode, toggleGeneratedFileSelection, versionOptions, workflowMode } = controller;
  return <>
<div className="generated-layout">
            <div className="generated-list-panel">
              <div className="generated-filter-row">
                <label className="field"><span>Preview type</span>
                  <select value={selectedGeneratedCategory} onChange={(e) => setSelectedGeneratedCategory(e.target.value as GeneratedContentCategory)}>
                    {generatedContentCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                  </select>
                </label>

                <label className="field"><span>Search within selected type</span>
                  <input value={generatedSearch} onChange={(e) => setGeneratedSearch(e.target.value)} placeholder="Search filename or folder" />
                </label>
              </div>

              {selectedGeneratedCategory === "visuals" && versionOptions.length > 0 && (
                <div className="version-control-card">
                  <label className="field"><span>Visual version</span>
                    <select value={selectedGeneratedVersion} onChange={(e) => setSelectedGeneratedVersion(e.target.value)}>
                      {versionOptions.map((version) => (
                        <option key={version} value={version}>{version}</option>
                      ))}
                    </select>
                  </label>
                  <p>Only the selected version is shown and exported.</p>
                </div>
              )}

              {filteredGeneratedFiles.length === 0 ? (
                <div className="empty-state">
                  <h3>No files match the selected filters.</h3>
                  <p>Current filter: {categoryLabel(selectedGeneratedCategory)}</p>
                </div>
              ) : (
                <div className="generated-file-list">
                  {filteredGeneratedFiles.map((file) => (
                    <div key={file.id} className={`generated-file-card ${workflowMode}-generated-file-card${selectedGeneratedFile?.id === file.id ? " active" : ""}`}>
                      {workflowMode === "export" && <label className="generated-select">
                        <input
                          type="checkbox"
                          checked={selectedGeneratedFileIds.includes(file.id)}
                          disabled={file.fileType !== "image" || !/\.(png|jpe?g)$/i.test(file.filename)}
                          onChange={() => toggleGeneratedFileSelection(file.id)}
                        />
                        <span>Select</span>
                      </label>}
                      <button type="button" className="generated-file-main" onClick={() => setSelectedGeneratedFileId(file.id)}>
                        <strong>{file.displayName || basenameWithoutExtension(file.filename)}</strong>
                        <span>{file.versionLabel || "Unversioned"}</span>
                        <small>{categoryLabel(file.category)} | {file.fileType} | {formatFileSize(file.sizeBytes)}</small>
                        <code>{file.projectRelativePath || file.generatedRelativePath}</code>
                      </button>
                      {workflowMode !== "export" && <button
                        type="button"
                        className="secondary-button compact-button generated-distribute-button"
                        onClick={() => {
                          if (!selectedProject) return;
                          setDistributionPrefill({
                            projectFolder: selectedProject.folder,
                            contentLabel: file.displayName || basenameWithoutExtension(file.filename),
                            generatedContentIds: [file.id],
                          });
                          setWorkflowMode("distribution");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Plan/send
                      </button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="preview-panel">
              <div className="preview-header">
                <div>
                  <h3>{filePreviewTitle(selectedGeneratedFile)}</h3>
                  {selectedGeneratedFile && <p>{selectedGeneratedFile.routePath || selectedGeneratedFile.relativePath}</p>}
                </div>
                {selectedGeneratedFile && <a className="secondary-button open-link" href={selectedGeneratedFile.fileUrl} target="_blank" rel="noreferrer">Open file</a>}
              </div>

              {!selectedGeneratedFile ? (
                <div className="preview-empty">Select a generated file matching the active filters.</div>
              ) : selectedGeneratedFile.fileType === "image" ? (
                <div className="image-preview"><img src={selectedGeneratedFile.fileUrl} alt={selectedGeneratedFile.filename} /></div>
              ) : selectedGeneratedFile.fileType === "pdf" || selectedGeneratedFile.fileType === "text" ? (
                <iframe className="document-preview" src={selectedGeneratedFile.fileUrl} title={selectedGeneratedFile.filename} />
              ) : (
                <div className="preview-empty"><p>Browser preview is not available for this file type. Use Open file.</p></div>
              )}
            </div>
          </div>
  </>;
}
