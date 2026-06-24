import type { BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import type { GeneratedContentCategory } from "../../../lib/prompt-builder/project-generated-content-api";
import type { PromptBuilderController } from "../controllers/prompt-builder-view";

export function ProjectWizardSection({ controller }: { controller: PromptBuilderController }) {
  const { ProjectWizard, brandList, handleCreateProject, isCreatingProject, isProjectWizardOpen, projectCreateError, projectDraft, projectScaffoldPreview, projectWizardStep, projectWorkflowOptions, setIsProjectWizardOpen, setProjectDraft, setProjectWizardStep, slugifyProjectName, storageState, targetFolder } = controller;
  return <>
      {isProjectWizardOpen && (
        <ProjectWizard>
            <div className="modal-header">
              <div>
                <p className="eyebrow">New project | Step {projectWizardStep} of 3</p>
                <h2 id="project-wizard-title">Create a branded project workspace</h2>
                <p>The project will be written to the paired local content root and opened immediately.</p>
              </div>
              <button className="quiet-button" type="button" onClick={() => setIsProjectWizardOpen(false)}>Close</button>
            </div>

            <div className="wizard-progress" aria-label="Project creation progress">
              {["Workflow", "Project brief", "Review files"].map((label, index) => (
                <div key={label} className={projectWizardStep >= index + 1 ? "active" : ""}><span>{index + 1}</span><strong>{label}</strong></div>
              ))}
            </div>

            <div className="wizard-body">
              {projectWizardStep === 1 && (
                <div className="wizard-section">
                  <div className="wizard-field-grid">
                    <label className="field"><span>Brand</span>
                      <select value={projectDraft.brandId} onChange={(event) => {
                        const brand = brandList.find((item) => item.id === event.target.value);
                        if (!brand) return;
                        setProjectDraft((current) => ({
                          ...current,
                          brandId: brand.id,
                          brandName: brand.label,
                          headerText: current.projectName ? `${brand.label} | ${current.projectName}` : brand.label,
                          footerText: brand.label,
                          logoAsset: brand.logoAssets[0]?.path || brand.logoAsset || "",
                        }));
                      }}>
                        {brandList.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}
                      </select>
                    </label>
                    <label className="field"><span>Project name</span>
                      <input value={projectDraft.projectName} onChange={(event) => {
                        const projectName = event.target.value;
                        setProjectDraft((current) => ({
                          ...current,
                          projectName,
                          projectSlug: slugifyProjectName(projectName),
                          headerText: `${current.brandName} | ${projectName}`,
                        }));
                      }} placeholder="Standard Bank opportunity" />
                    </label>
                    <label className="field"><span>Project slug</span>
                      <input value={projectDraft.projectSlug} onChange={(event) => setProjectDraft((current) => ({ ...current, projectSlug: slugifyProjectName(event.target.value) }))} placeholder="standard-bank-opportunity" />
                    </label>
                  </div>
                  <div className="workflow-choice-grid">
                    {projectWorkflowOptions.map((workflow) => (
                      <button key={workflow.id} className={`workflow-choice ${projectDraft.workflow === workflow.id ? "active" : ""}`} type="button" onClick={() => setProjectDraft((current) => ({ ...current, workflow: workflow.id, enabledOptionalFiles: [] }))}>
                        <strong>{workflow.label}</strong><span>{workflow.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {projectWizardStep === 2 && (
                <div className="wizard-section wizard-brief-grid">
                  <label className="field"><span>Audience</span><textarea value={projectDraft.audience} onChange={(event) => setProjectDraft((current) => ({ ...current, audience: event.target.value }))} placeholder="Who will read or view this work?" /></label>
                  <label className="field"><span>Purpose</span><textarea value={projectDraft.purpose} onChange={(event) => setProjectDraft((current) => ({ ...current, purpose: event.target.value }))} placeholder="What should this project achieve?" /></label>
                  <label className="field"><span>Tone</span><textarea value={projectDraft.tone} onChange={(event) => setProjectDraft((current) => ({ ...current, tone: event.target.value }))} /></label>
                </div>
              )}

              {projectWizardStep === 3 && (
                <div className="wizard-section wizard-review-grid">
                  <div className="wizard-chrome-fields">
                    <label className="field"><span>Header text</span><input value={projectDraft.headerText} onChange={(event) => setProjectDraft((current) => ({ ...current, headerText: event.target.value }))} /></label>
                    <label className="field"><span>Footer text</span><input value={projectDraft.footerText} onChange={(event) => setProjectDraft((current) => ({ ...current, footerText: event.target.value }))} /></label>
                    <label className="field"><span>Logo asset</span>
                      <select value={projectDraft.logoAsset} onChange={(event) => setProjectDraft((current) => ({ ...current, logoAsset: event.target.value }))}>
                        {(brandList.find((brand) => brand.id === projectDraft.brandId)?.logoAssets || []).map((asset) => <option key={asset.path} value={asset.path}>{asset.filename}</option>)}
                      </select>
                    </label>
                    <div className="target-folder"><span>Target folder</span><code>{projectScaffoldPreview.targetFolder}</code></div>
                  </div>
                  <div className="scaffold-tree">
                    <h3>Files to create</h3>
                    {projectScaffoldPreview.requiredFiles.map((file) => <div className="scaffold-file required" key={file.path}><span aria-hidden="true">Ã¢Å“â€œ</span><code>{file.path}</code><small>Required</small></div>)}
                    {projectScaffoldPreview.optionalFiles.map((file) => (
                      <label className="scaffold-file" key={file.path}>
                        <input type="checkbox" checked={projectDraft.enabledOptionalFiles.includes(file.path)} onChange={() => setProjectDraft((current) => ({
                          ...current,
                          enabledOptionalFiles: current.enabledOptionalFiles.includes(file.path)
                            ? current.enabledOptionalFiles.filter((path) => path !== file.path)
                            : [...current.enabledOptionalFiles, file.path],
                        }))} />
                        <code>{file.path}</code><small>Optional</small>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {projectCreateError && <div className="automation-error">{projectCreateError}</div>}
              {projectScaffoldPreview.errors.length > 0 && projectWizardStep === 3 && <div className="automation-error">{projectScaffoldPreview.errors.join(" ")}</div>}
            </div>

            <div className="modal-actions">
              {projectWizardStep > 1 && <button className="secondary-button" type="button" onClick={() => setProjectWizardStep((step) => step - 1)}>Back</button>}
              {projectWizardStep < 3 ? (
                <button className="primary-button" type="button" disabled={(projectWizardStep === 1 && (!projectDraft.projectName || !projectDraft.projectSlug)) || (projectWizardStep === 2 && (!projectDraft.audience || !projectDraft.purpose || !projectDraft.tone))} onClick={() => setProjectWizardStep((step) => step + 1)}>Continue</button>
              ) : (
                <button className="primary-button" type="button" disabled={isCreatingProject || projectScaffoldPreview.errors.length > 0 || storageState !== "available"} onClick={handleCreateProject}>{isCreatingProject ? "Creating..." : "Create project"}</button>
              )}
            </div>
        </ProjectWizard>
      )}


  </>;
}

