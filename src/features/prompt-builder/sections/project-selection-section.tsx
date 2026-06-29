import { useMemo } from "react";
import type { BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import type { GeneratedContentCategory } from "../../../lib/prompt-builder/project-generated-content-api";
import { detectSourceVersions, getUniqueFolderNames } from "../../../lib/prompt-builder/source-version-detection";
import type { PromptBuilderController } from "../controllers/prompt-builder-view";

export function ProjectSelectionSection({ controller }: { controller: PromptBuilderController }) {
  const { backgroundPresets, backgroundThemes, browserFsAvailable, compiled, contentSets, contentTypeLabel, contentTypes, documentBackgroundPresets, handleUpdateStorageRoot, isDocumentLike, layoutPresets, logoPreviewPath, profileList, selectedBackgroundPresetId, selectedBackgroundTheme, selectedBrand, selectedContentPath, selectedContentSet, selectedContentType, selectedDocumentBackgroundPresetId, selectedLayoutPresetId, selectedOutputProfileId, selectedProjectLogoAsset, setSelectedBackgroundPresetId, setSelectedBackgroundTheme, setSelectedContentPath, setSelectedContentSet, setSelectedContentType, setSelectedDocumentBackgroundPresetId, setSelectedLayoutPresetId, setSelectedOutputProfileId, setStorageRoot, storageRoot, storageState, visibleContentFiles, workflowMode, workspaceKind } = controller;
  const usingBrowserWorkspace = workspaceKind === "browser" || (browserFsAvailable && storageState !== "available");

  // Detect multiple source versions for current content set
  const sourceVersions = useMemo(
    () => detectSourceVersions(visibleContentFiles),
    [visibleContentFiles]
  );
  const currentVersions = sourceVersions.get(selectedContentSet) ?? [];

  // Extract unique folder names from versions
  const uniqueFolders = useMemo(
    () => getUniqueFolderNames(currentVersions),
    [currentVersions]
  );

  // Extract current folder from selected path
  const currentFolderName = useMemo(() => {
    const pathParts = selectedContentPath.replace(/\\/g, '/').split('/');
    for (let i = pathParts.length - 2; i >= 0; i--) {
      const part = pathParts[i];
      if (part.match(/^[_-]?v?\d+$/i)) {
        return part;
      }
    }
    return '';
  }, [selectedContentPath]);

  // Filter files to only show those from current folder
  const filteredContentFiles = useMemo(
    () => visibleContentFiles.filter((f) => {
      if (!currentFolderName) return true; // No filter if no folder selected
      return f.path.includes(`/${currentFolderName}/`) || f.path.includes(`\\${currentFolderName}\\`);
    }),
    [visibleContentFiles, currentFolderName]
  );

  // Handle version folder change
  const handleVersionChange = (newFolderName: string) => {
    // Find first file in new folder
    const fileInFolder = currentVersions.find(
      (v) => v.folderName === newFolderName
    );
    if (fileInFolder) {
      setSelectedContentPath(fileInFolder.path);
    }
  };
  return <>
        {(workflowMode === "create" || workflowMode === "run") && (
        <aside className="panel sidebar-panel">
          <div className="panel-title">
            <h2>{workflowMode === "create" ? "Create controls" : "Run controls"}</h2>
            <p>Source and output controls for {workflowMode}.</p>
          </div>

          <div className="form-stack">
            <label className="field"><span>Output Type</span>
              <select value={selectedContentType} onChange={(e) => setSelectedContentType(e.target.value)}>
                {contentTypes.map((type) => <option key={type} value={type}>{contentTypeLabel(type)}</option>)}
              </select>
            </label>

            <label className="field"><span>Content Set</span>
              <select value={selectedContentSet} onChange={(e) => setSelectedContentSet(e.target.value)}>
                {contentSets.map((contentSet) => <option key={contentSet} value={contentSet}>{contentTypeLabel(contentSet)}</option>)}
              </select>
            </label>

            <label className="field"><span>Source File</span>
              <select value={selectedContentPath} onChange={(e) => setSelectedContentPath(e.target.value)}>
                {filteredContentFiles.map((entry) => <option key={entry.path} value={entry.path}>{entry.label}</option>)}
              </select>
            </label>

            {uniqueFolders.length > 0 && (
              <label className="field"><span>Source Version</span>
                <select value={currentFolderName} onChange={(e) => handleVersionChange(e.target.value)}>
                  {uniqueFolders.map((folder) => <option key={folder.folderName} value={folder.folderName}>{folder.folderName}</option>)}
                </select>
              </label>
            )}

            <label className="field"><span>Output Profile</span>
              <select value={selectedOutputProfileId} onChange={(e) => setSelectedOutputProfileId(e.target.value)}>
                {profileList.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
              </select>
            </label>

            {workflowMode === "create" && <><label className="field"><span>Layout Style</span>
              <select value={selectedLayoutPresetId} onChange={(e) => setSelectedLayoutPresetId(e.target.value)}>
                {layoutPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>

            <label className="field"><span>Background theme</span>
              <select value={selectedBackgroundTheme} onChange={(e) => setSelectedBackgroundTheme(e.target.value as BackgroundTheme)}>
                {backgroundThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
              </select>
            </label>

            {!isDocumentLike && (
              <label className="field"><span>Advanced visual preset</span>
                <select value={selectedBackgroundPresetId} onChange={(e) => setSelectedBackgroundPresetId(e.target.value)}>
                  {backgroundPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select>
              </label>
            )}

            {isDocumentLike && (
              <label className="field"><span>Page treatment</span>
                <select value={selectedDocumentBackgroundPresetId} onChange={(e) => setSelectedDocumentBackgroundPresetId(e.target.value)}>
                  {documentBackgroundPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select>
                <p className="field-note">Auto uses the selected brand/project document, logo, header, footer and table rules. Use the other options only to force a neutral page format.</p>
              </label>
            )}
            </>}
          </div>

          {workflowMode === "create" && <>
          <details className="storage-settings" open={storageState !== "available"}>
            <summary><span>Local storage</span><strong className={`connection-${storageState}`}>{storageState}</strong></summary>
            <div className="storage-settings-body">
              {storageState === "read-only" && browserFsAvailable && <p className="storage-notice">This hosted build can still work with your local files if you connect a local <code>content</code> folder in the browser. Choose the folder once, then the app can read and save Markdown files inside it.</p>}
              {storageState === "read-only" && !browserFsAvailable && <p className="storage-notice">Local write tools are unavailable in this browser. Run <code>npm run dev</code> on your computer to create projects, save files, upload assets and export documents.</p>}
              <label className="field"><span>{usingBrowserWorkspace ? "Connected local folder" : "Content root"}</span><input value={storageRoot} onChange={(event) => setStorageRoot(event.target.value)} readOnly={usingBrowserWorkspace} disabled={storageState !== "available" && !browserFsAvailable} placeholder={usingBrowserWorkspace ? "Choose your local content folder" : "C:\\Users\\name\\OneDrive\\Prompt Builder\\content"} /></label>
              <div className="button-row">
                <button className="secondary-button compact-button" type="button" disabled={storageState !== "available" && !browserFsAvailable} onClick={() => handleUpdateStorageRoot(false)}>{usingBrowserWorkspace ? "Choose folder" : "Use root"}</button>
                <button className="quiet-button compact-button" type="button" disabled={storageState !== "available" && !browserFsAvailable} onClick={() => handleUpdateStorageRoot(true)}>{usingBrowserWorkspace ? "Choose + initialize" : "Initialize root"}</button>
              </div>
              <p className="field-note">{usingBrowserWorkspace ? "Choose the local Prompt Builder content folder itself, or a parent folder that contains a content folder. Initialization creates missing folders such as projects when needed." : "The main app writes to this folder. Initialization copies missing brand seed files without overwriting existing content."}</p>
            </div>
          </details>

          <div className="logo-preview-card">
            <div className="small-label">Resolved logo</div>
            <div className="logo-stage">
              <img src={logoPreviewPath} alt={`${selectedBrand?.label ?? "Brand"} logo`} />
            </div>
            <code>{compiled.promptPreview.logoAsset || selectedProjectLogoAsset || selectedBrand?.logoPreviewPath}</code>
          </div>

          <div className="status-card">
            <h3>Dynamic Analysis</h3>
            {compiled.dynamicLayoutPlan ? (
              <>
                <p className="status-ok">{compiled.dynamicLayoutPlan.contentKind} | {compiled.dynamicLayoutPlan.density?.level ?? "unknown"}</p>
                <p>{isDocumentLike ? "Structure" : "Layout"}: <strong>{compiled.dynamicLayoutPlan.layoutPresetId}</strong></p>
                <p>Theme: <strong>{compiled.promptPreview.backgroundTheme}</strong></p>
                <p>{isDocumentLike ? "Page treatment" : "Background"}: <strong>{compiled.dynamicLayoutPlan.backgroundPresetId}</strong></p>
                <p>Fidelity: <strong>{compiled.fidelityScore}/100</strong></p>
              </>
            ) : <p>No analysis available.</p>}
            {compiled.promptLint.issues.length > 0 && (
              <ul>{compiled.promptLint.issues.slice(0, 4).map((issue) => <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>)}</ul>
            )}
            {compiled.warnings.length > 0 && (
              <ul>{compiled.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            )}
          </div>
          </>}
        </aside>
        )}


  </>;
}
