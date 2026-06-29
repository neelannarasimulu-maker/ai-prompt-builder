import type { BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import type { GeneratedContentCategory } from "../../../lib/prompt-builder/project-generated-content-api";
import type { PromptBuilderController } from "../controllers/prompt-builder-view";

export function PromptHeaderSection({ controller }: { controller: PromptBuilderController }) {
  const { DistributionPanel, allProjectContent, approvedGeneratedFileIds, assistTargetVersion, batchEligibleEntries, batchPromptItems, brandList, brandQaScorecard, clearGeneratedImageSelection, compiled, customOutputFilename, distributionPrefill, exportableGeneratedImages, filteredGeneratedFiles, filteredProjects, handleCopyBatchRunManifest, handleCopyDocumentAssemblyPrompt, handleCopyOutputFilename, handleCopyPromptAndOpenChatGPT, handleCopyStyleMemory, handleCopyVariantPrompt, handleExportGeneratedContent, isDocumentLike, isExportingGeneratedContent, isImageOutput, localWritesAvailable, normalizeAssistImageFilename, normalizeAssistVersionLabel, openAssistModal, openProjectWizard, promptRecipes, selectAllBatchContent, selectAllGeneratedImagesInVersion, selectedBatchContentPaths, selectedBrandId, selectedContentEntry, selectedExportFiles, selectedGeneratedFile, selectedGeneratedVersion, selectedOutputProfile, selectedProject, selectedProjectId, selectedRecipe, selectedRecipeId, selectedVariant, selectedVariantId, setDistributionPrefill, setSelectedBrandId, setSelectedProjectId, setSelectedRecipeId, setSelectedVariantId, setWorkflowMode, showToast, suggestedOutputFilename, targetFolder, toggleApprovedGeneratedFile, toggleBatchContentPath, variantDirections, workflowMode, workflowModes } = controller;
  return <>
      <header className="hero-bar">
        <div>
          <p className="eyebrow">AI Visual Studio</p>
          <h1>Prompt Builder Workbench</h1>
          <p>
            Move from source to ChatGPT to reviewed output faster, while
            keeping brand chrome, exact text and project consistency locked.
          </p>
        </div>
        {(workflowMode === "create" || workflowMode === "run") && <div className="hero-metrics">
          <div><span>{compiled.promptStats.words}</span><small>prompt words</small></div>
          <div><span>{compiled.promptStats.visibleTextLines}</span><small>visible lines</small></div>
          <div><span>{compiled.fidelityScore}</span><small>fidelity score</small></div>
          <div><span>{filteredGeneratedFiles.length}</span><small>filtered files</small></div>
        </div>}
      </header>

      <section className="master-context" aria-label="Master brand and project filter">
        <label className="field"><span>Brand</span><select value={selectedBrandId} onChange={(event) => setSelectedBrandId(event.target.value)}>{brandList.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}</select></label>
        <label className="field"><span>Project</span><select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>{filteredProjects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select></label>
        <button className="icon-button add-project-button" type="button" title="Create a new project" aria-label="Create a new project" onClick={openProjectWizard}>+</button>
      </section>

      <nav className="workflow-nav" aria-label="Workflow modes">
        {workflowModes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={workflowMode === mode.id ? "active" : ""}
            onClick={() => setWorkflowMode(mode.id)}
          >
            <strong>{mode.label}</strong>
            <span>{mode.summary}</span>
          </button>
        ))}
      </nav>

      <section className="panel workflow-panel">
        {workflowMode === "create" && (
          <div className="workflow-grid">
            <div className="workflow-card">
              <span>Prompt recipe</span>
              <label className="field">
                <select value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>
                  {promptRecipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>{recipe.label}</option>
                  ))}
                </select>
              </label>
              <p>{selectedRecipe.instruction}</p>
              <small>Profile: {selectedRecipe.outputProfileId} | Density: {selectedRecipe.densityTolerance}</small>
            </div>

            <div className="workflow-card">
              <span>Variant Studio</span>
              <label className="field">
                <select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)}>
                  {variantDirections.map((variant) => (
                    <option key={variant.id} value={variant.id}>{variant.label}</option>
                  ))}
                </select>
              </label>
              <p>{selectedVariant.emphasis}</p>
              <button className="primary-button" type="button" onClick={handleCopyVariantPrompt}>Copy variant prompt</button>
            </div>

            <div className="workflow-card wide-card">
              <span>Document Assembly Mode</span>
              <strong>{allProjectContent.filter((entry) => entry.type === "documents").length} document source file(s)</strong>
              <p>Build one branded Word/PDF-style pack from all project document markdown files, preserving source facts and tables.</p>
              <button className="secondary-button" type="button" onClick={handleCopyDocumentAssemblyPrompt}>Copy assembly prompt</button>
            </div>
          </div>
        )}

        {workflowMode === "run" && (
          <div className="workflow-grid workflow-grid-run">
            <div className="workflow-card primary-workflow-card run-lane-card">
              <span>One-click ChatGPT run lane</span>
              <strong>{selectedContentEntry?.label || "No content selected"}</strong>
              <p>{isImageOutput ? "Prompt, filename, ChatGPT tab, logo reminder, latest-download import and preview refresh in one guided flow." : "Copy the run-ready prompt and open ChatGPT for document, PDF, text or email generation."}</p>
              <div className="run-lane-points">
                <p>1. Copy the prompt and output filename exactly as shown.</p>
                <p>2. Generate only the content the app asks for, not a combined batch response.</p>
                <p>3. Save or import the finished output back into the locked project path.</p>
              </div>
              <div className="button-row run-lane-actions">
                <button className="primary-button" type="button" onClick={isImageOutput ? openAssistModal : handleCopyPromptAndOpenChatGPT}>{isImageOutput ? "Start run lane" : "Copy + open ChatGPT"}</button>
                <button className="secondary-button" type="button" onClick={handleCopyPromptAndOpenChatGPT}>Copy + open</button>
              </div>
            </div>

            <div className="workflow-card wide-card batch-card">
              <span>Batch Generate Deck / Pack</span>
              <p className="batch-card-note">Queue multiple source files, but still run each one as its own polished output in ChatGPT. The copied batch queue now reinforces that one-at-a-time workflow.</p>
              <div className="batch-actions">
                <strong>{batchPromptItems.length} selected</strong>
                <button className="secondary-button compact-button" type="button" onClick={selectAllBatchContent}>Select all visible</button>
                <button className="primary-button compact-button" type="button" onClick={handleCopyBatchRunManifest}>Copy batch queue</button>
              </div>
              <div className="batch-list">
                {batchEligibleEntries.map((entry) => (
                  <label key={entry.path} className="batch-item">
                    <input
                      type="checkbox"
                      checked={selectedBatchContentPaths.includes(entry.path)}
                      onChange={() => toggleBatchContentPath(entry.path)}
                    />
                    <span>{entry.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="workflow-card run-support-card storage-workflow-card">
              <span>Run target</span>
              <strong>{customOutputFilename || suggestedOutputFilename}</strong>
              <p>{isImageOutput ? "The app will import the generated artwork into the locked frame after download." : isDocumentLike ? "Use the app renderer when you want the final locked Word/PDF output with chrome applied." : "Use direct ChatGPT output for text-first workflows, then store the final artifact in the project path."}</p>
              <div className="run-support-grid">
                <div>
                  <small>Output profile</small>
                  <strong>{selectedOutputProfile.label}</strong>
                </div>
                <div>
                  <small>{isImageOutput ? "Target version" : "Run mode"}</small>
                  <strong>{isImageOutput ? assistTargetVersion || selectedGeneratedVersion || "v001" : isDocumentLike ? "Locked render available" : "Direct output"}</strong>
                </div>
                <div>
                  <small>Generated folder</small>
                  <strong>{targetFolder || "Resolve a project and content set to show the save path."}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {workflowMode === "review" && (
          <div className="workflow-grid">
            {/* Brand QA Scorecard, Project Style Memory, Output Comparison hidden from Review tab cleanup */}
          </div>
        )}

        {workflowMode === "export" && (
          <div className="workflow-grid">
            <div className="workflow-card primary-workflow-card">
              <span>Delivery pack</span>
              <strong>{selectedExportFiles.length} export-ready visual(s)</strong>
              <p>Export the selected PNG/JPEG visuals as a branded PPTX or PDF named from brand, project and version.</p>
              <div className="button-row">
                <button className="primary-button" type="button" onClick={() => handleExportGeneratedContent("pptx")} disabled={!localWritesAvailable || selectedExportFiles.length === 0 || isExportingGeneratedContent}>Export PPTX</button>
                <button className="secondary-button" type="button" onClick={() => handleExportGeneratedContent("pdf")} disabled={!localWritesAvailable || selectedExportFiles.length === 0 || isExportingGeneratedContent}>Export PDF</button>
              </div>
            </div>

            <div className="workflow-card">
              <span>Selection tools</span>
              <strong>{exportableGeneratedImages.length} image(s) in view</strong>
              <div className="button-row">
                <button className="secondary-button compact-button" type="button" onClick={selectAllGeneratedImagesInVersion}>Select all</button>
                <button className="secondary-button compact-button" type="button" onClick={clearGeneratedImageSelection}>Clear</button>
              </div>
            </div>

            <div className="workflow-card wide-card storage-workflow-card">
              <span>Storage target</span>
              <strong>{targetFolder || "No upload folder resolved"}</strong>
              <p>Local writes go to the machine running this app. In a hosted deployment, use the browser-connected local content folder option when available, or point the local app at OneDrive or another hard drive folder.</p>
            </div>
          </div>
        )}

        {workflowMode === "distribution" && (
          <DistributionPanel
            project={selectedProject}
            writable={localWritesAvailable}
            prefill={distributionPrefill}
            onPrefillConsumed={() => setDistributionPrefill(null)}
            onNotice={showToast}
          />
        )}
      </section>


  </>;
}
