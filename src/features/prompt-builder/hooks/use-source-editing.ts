import { useEffect, useState } from "react";
import { useSourceFixWorkflow } from "./use-source-fix-workflow";
import {
  buildProjectLogoMarkdown,
  firstLogoAssetPath,
  getBrandFile,
  getBrandLogoSource,
  getProjectFile,
  logoNotesFromMarkdown,
} from "../../../core/content/static-content-repository";


import type { usePromptSelections } from "./use-prompt-selections";

export function useSourceEditing(scope: ReturnType<typeof usePromptSelections>) {
  const { brandList, profileList, setRuntimeProjects, setRuntimeFilesByProject, projectList, storageRoot, setStorageRoot, storageState, setStorageState, localWritesAvailable, selectedBrandId, setSelectedBrandId, filteredProjects, selectedProjectId, setSelectedProjectId, selectedBrand, selectedProject, refreshRuntimeRepository, activeRuntimeFiles, allProjectContent, session, selectedContentType, setSelectedContentType, selectedContentSet, setSelectedContentSet, selectedContentPath, setSelectedContentPath, editableMarkdown, setEditableMarkdown, savedMarkdownByPath, setSavedMarkdownByPath, selectedOutputProfileId, setSelectedOutputProfileId, selectedLayoutPresetId, setSelectedLayoutPresetId, selectedBackgroundPresetId, setSelectedBackgroundPresetId, selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId, selectedBackgroundTheme, setSelectedBackgroundTheme, promptView, setPromptView, selectedDocumentChunkIndex, setSelectedDocumentChunkIndex, customOutputFilename, setCustomOutputFilename, workflowMode, setWorkflowMode, selectedRecipeId, setSelectedRecipeId, selectedVariantId, setSelectedVariantId, selectedBatchContentPaths, setSelectedBatchContentPaths, approvedGeneratedFileIds, setApprovedGeneratedFileIds, toasts, showToast, isProjectWizardOpen, setIsProjectWizardOpen, projectWizardStep, setProjectWizardStep, projectDraft, setProjectDraft, projectCreateError, setProjectCreateError, isCreatingProject, setIsCreatingProject, contentTypes, contentSets, visibleContentFiles, selectedContentEntry, selectedOutputProfile, suggestedOutputFilename } = scope;
  const brandRules = selectedBrand ? getBrandFile(selectedBrand, "brand.md") : "";
  const headerRules = selectedBrand ? getBrandFile(selectedBrand, "header.md") : "";
  const footerRules = selectedBrand ? getBrandFile(selectedBrand, "footer.md") : "";
  const logoRules = selectedBrand ? getBrandFile(selectedBrand, "logo-rules.md") : "";
  const typographyRules = selectedBrand ? getBrandFile(selectedBrand, "typography.md") : "";
  const documentRules = selectedBrand ? getBrandFile(selectedBrand, "document-rules.md") : "";
  const tableRules = selectedBrand ? getBrandFile(selectedBrand, "table-rules.md") : "";
  const brandVisualRules = selectedBrand ? getBrandFile(selectedBrand, "visual-rules.md") : "";
  const runtimeMarkdown = Object.fromEntries(activeRuntimeFiles.map((file) => [file.path, file.raw]));
  const activeProjectFile = (fileName: string) => selectedProject
    ? runtimeMarkdown[`${selectedProject.folder}/${fileName}`] ?? getProjectFile(selectedProject, fileName)
    : "";
  const projectRules = activeProjectFile("project.md");
  const projectHeaderPath = selectedProject ? `${selectedProject.folder}/header.md` : "";
  const projectFooterPath = selectedProject ? `${selectedProject.folder}/footer.md` : "";
  const projectLogoPath = selectedProject ? `${selectedProject.folder}/logo.md` : "";
  const projectHeaderSource = activeProjectFile("header.md");
  const projectFooterSource = activeProjectFile("footer.md");
  const projectLogoSource = activeProjectFile("logo.md");
  const projectVisualRules = activeProjectFile("visual-rules.md");
  const projectDocumentRules = activeProjectFile("document-rules.md");
  const visualRules = [brandVisualRules, projectVisualRules].filter(Boolean).join("\n\n");
  const logoSourceText = getBrandLogoSource(selectedBrand);
  const brandLogoAssets = selectedBrand?.logoAssets ?? [];
  const [editableProjectHeader, setEditableProjectHeader] = useState("");
  const [editableProjectFooter, setEditableProjectFooter] = useState("");
  const [editableProjectLogo, setEditableProjectLogo] = useState("");
  const [selectedProjectLogoAsset, setSelectedProjectLogoAsset] = useState("");
  const [editableProjectLogoNotes, setEditableProjectLogoNotes] = useState("");

  useEffect(() => {
    setEditableProjectHeader(projectHeaderPath ? savedMarkdownByPath[projectHeaderPath] ?? projectHeaderSource : "");
  }, [projectHeaderPath, projectHeaderSource, savedMarkdownByPath]);

  useEffect(() => {
    setEditableProjectFooter(projectFooterPath ? savedMarkdownByPath[projectFooterPath] ?? projectFooterSource : "");
  }, [projectFooterPath, projectFooterSource, savedMarkdownByPath]);

  useEffect(() => {
    const source = projectLogoPath ? savedMarkdownByPath[projectLogoPath] ?? projectLogoSource : "";
    const assetPath = firstLogoAssetPath(source);
    setSelectedProjectLogoAsset(assetPath || brandLogoAssets[0]?.path || "");
    setEditableProjectLogoNotes(logoNotesFromMarkdown(source));
    setEditableProjectLogo(source || buildProjectLogoMarkdown(brandLogoAssets[0]?.path || "", ""));
  }, [projectLogoPath, projectLogoSource, savedMarkdownByPath, brandLogoAssets]);

  useEffect(() => {
    setEditableProjectLogo(buildProjectLogoMarkdown(selectedProjectLogoAsset, editableProjectLogoNotes));
  }, [selectedProjectLogoAsset, editableProjectLogoNotes]);

  const sourceFixWorkflow = useSourceFixWorkflow(editableMarkdown, setEditableMarkdown, workflowMode, setWorkflowMode);

  return { ...scope, brandRules, headerRules, footerRules, logoRules, typographyRules, documentRules, tableRules, brandVisualRules, runtimeMarkdown, activeProjectFile, projectRules, projectHeaderPath, projectFooterPath, projectLogoPath, projectHeaderSource, projectFooterSource, projectLogoSource, projectVisualRules, projectDocumentRules, visualRules, logoSourceText, brandLogoAssets, editableProjectHeader, setEditableProjectHeader, editableProjectFooter, setEditableProjectFooter, editableProjectLogo, setEditableProjectLogo, selectedProjectLogoAsset, setSelectedProjectLogoAsset, editableProjectLogoNotes, setEditableProjectLogoNotes, ...sourceFixWorkflow };
}
