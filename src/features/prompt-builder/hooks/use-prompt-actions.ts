import { useEffect, useMemo, useState } from "react";
import {
  DistributionPanel,
  type DistributionPrefill,
} from "../../distribution/distribution-panel";

import { outputProfiles } from "../../../lib/prompt-builder/output-profiles";
import { backgroundPresets, getBackgroundPreset } from "../../../lib/prompt-builder/background-presets";
import { documentBackgroundPresets, getDocumentBackgroundPreset } from "../../../lib/prompt-builder/document-background-presets";
import { backgroundThemes, type BackgroundTheme } from "../../../lib/prompt-builder/background-themes";
import { layoutPresets, getLayoutPreset } from "../../../lib/prompt-builder/layout-presets";
import { compilePrompt } from "../../../lib/prompt-builder/prompt-compiler";
import { parseMarkdownSections } from "../../../lib/prompt-builder/content-sections";
import {
  getDeliveryPackFilenameBase,
  getSuggestedOutputFilename,
  replaceExtension,
} from "../../../lib/prompt-builder/output-naming";
import {
  getDefaultAssistVersionLabel,
  importLatestChatGptDownload,
  normalizeAssistImageFilename,
  normalizeAssistVersionLabel,
  validateAssistImportInput,
} from "../../../lib/prompt-builder/chatgpt-assist";
import {
  basenameWithoutExtension,
  copyContentFileToClipboard,
  copyableFilename,
  enrichGeneratedContentFile,
  exportProjectGeneratedContent,
  formatFileSize,
  generatedCategoryForProfile,
  generatedContentCategories,
  getGeneratedVersionSortValue,
  getProjectGeneratedContentFolder,
  listProjectGeneratedContent,
  renderProjectDocument,
  uploadProjectGeneratedContent,
  type GeneratedContentCategory,
  type GeneratedContentFile,
} from "../../../lib/prompt-builder/project-generated-content-api";
import {
  buildBatchRunManifest,
  buildBatchVisualPrompt,
  buildBrandQaScorecard,
  buildDocumentAssemblyPrompt,
  buildStyleMemoryPrompt,
  buildVariantPrompt,
  getPromptRecipe,
  getVariantDirection,
  promptRecipes,
  variantDirections,
  workflowModes,
  type BatchPromptItem,
} from "../../../lib/prompt-builder/workflow-features";
import {
  buildProjectScaffold,
  createProject,
  slugifyProjectName,
  type CreateProjectInput,
  type ProjectWorkflow,
} from "../../../lib/prompt-builder";
import {
  buildProjectLogoMarkdown,
  firstLogoAssetPath,
  getBrandFile,
  getBrandLogoSource,
  getProjectFile,
  logoNotesFromMarkdown,
} from "../../../core/content/static-content-repository";
import { listStaticBrands } from "../../../core/registry/registry-repository";
import type { BrandItem } from "../../../core/registry/types";
import { saveContentSourceFile, updateStorageRoot } from "../../../core/storage/storage-service";
import { useProjectWorkspace } from "../../projects/use-project-workspace";
import { usePromptBuilderSession } from "../use-prompt-builder-session";
import { useGeneratedContent } from "../../generated-content/use-generated-content";
import { useAutomationAssist } from "../../automation/use-automation-assist";
import { AutomationPanel } from "../../automation/automation-panel";
import { ProjectWizard } from "../../projects/project-wizard";
import { AppShell } from "../../../ui/layouts/app-shell";
import { ToastStack } from "../../../ui/components/toast-stack";
import { useToasts } from "../../../ui/hooks/use-toasts";

type OutputProfileItem = {
  id: string;
  label: string;
  outputType: "image" | "document" | "pdf" | "text" | "email";
  format?: string;
  useCase?: string;
  instruction?: string;
  typography?: string;
};

const projectWorkflowOptions: Array<{ id: ProjectWorkflow; label: string; description: string }> = [
  { id: "presentation", label: "Presentation", description: "Visual rules and a structured opening visual, with optional supporting slides." },
  { id: "document_pack", label: "Document pack", description: "Project document rules and an attachment-first main document source." },
  { id: "linkedin_campaign", label: "LinkedIn campaign", description: "A written post with an optional mobile visual source." },
  { id: "mixed", label: "Mixed project", description: "Visual, document and LinkedIn starter sources in one project." },
];

function newProjectDraft(brand?: BrandItem): CreateProjectInput {
  return {
    brandId: brand?.id || "",
    brandName: brand?.label || "",
    projectName: "",
    projectSlug: "",
    workflow: "presentation",
    audience: "",
    purpose: "",
    tone: "Professional, clear and aligned to the selected brand.",
    headerText: brand?.label || "",
    footerText: brand?.label || "",
    logoAsset: brand?.logoAssets[0]?.path || brand?.logoAsset || "",
    enabledOptionalFiles: [],
  };
}

function emptyPromptLint() {
  return {
    issues: [],
    fidelityScore: 0,
  };
}

function emptyPromptPreview() {
  return {
    visibleText: "",
    bodyContent: "",
    guidance: "",
    headerText: "",
    footerText: "",
    brandColours: "",
    logoAsset: "",
    backgroundTheme: "",
    detectedSections: [],
    ignoredLegacySections: [],
    coverPageContent: "",
    tableOfContentsContent: "",
    linkedinPostText: "",
  };
}

function outputPromptModeLabel(outputType?: OutputProfileItem["outputType"]): string {
  if (outputType === "image") return "Exact Image";
  if (outputType === "document") return "Exact Document";
  if (outputType === "pdf") return "Exact PDF";
  return "Exact Text/Email";
}

const generatedFileCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function contentTypeLabel(type: string): string {
  return type
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function categoryLabel(category: string): string {
  return generatedContentCategories.find((item) => item.id === category)?.label ?? category;
}

function filePreviewTitle(file: GeneratedContentFile | null): string {
  if (!file) return "No generated content selected";
  return `${file.displayName || basenameWithoutExtension(file.filename)} | ${formatFileSize(file.sizeBytes)}`;
}


import type { useContentSave } from "./use-content-save";

export function usePromptActions(scope: ReturnType<typeof useContentSave>) {
  const { brandList, profileList, setRuntimeProjects, setRuntimeFilesByProject, projectList, storageRoot, setStorageRoot, storageState, setStorageState, localWritesAvailable, selectedBrandId, setSelectedBrandId, filteredProjects, selectedProjectId, setSelectedProjectId, selectedBrand, selectedProject, refreshRuntimeRepository, activeRuntimeFiles, allProjectContent, session, selectedContentType, setSelectedContentType, selectedContentSet, setSelectedContentSet, selectedContentPath, setSelectedContentPath, editableMarkdown, setEditableMarkdown, savedMarkdownByPath, setSavedMarkdownByPath, selectedOutputProfileId, setSelectedOutputProfileId, selectedLayoutPresetId, setSelectedLayoutPresetId, selectedBackgroundPresetId, setSelectedBackgroundPresetId, selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId, selectedBackgroundTheme, setSelectedBackgroundTheme, promptView, setPromptView, selectedDocumentChunkIndex, setSelectedDocumentChunkIndex, customOutputFilename, setCustomOutputFilename, workflowMode, setWorkflowMode, selectedRecipeId, setSelectedRecipeId, selectedVariantId, setSelectedVariantId, selectedBatchContentPaths, setSelectedBatchContentPaths, approvedGeneratedFileIds, setApprovedGeneratedFileIds, toasts, showToast, isProjectWizardOpen, setIsProjectWizardOpen, projectWizardStep, setProjectWizardStep, projectDraft, setProjectDraft, projectCreateError, setProjectCreateError, isCreatingProject, setIsCreatingProject, contentTypes, contentSets, visibleContentFiles, selectedContentEntry, selectedOutputProfile, suggestedOutputFilename, brandRules, headerRules, footerRules, logoRules, typographyRules, documentRules, tableRules, brandVisualRules, runtimeMarkdown, activeProjectFile, projectRules, projectHeaderPath, projectFooterPath, projectLogoPath, projectHeaderSource, projectFooterSource, projectLogoSource, projectVisualRules, projectDocumentRules, visualRules, logoSourceText, brandLogoAssets, editableProjectHeader, setEditableProjectHeader, editableProjectFooter, setEditableProjectFooter, editableProjectLogo, setEditableProjectLogo, selectedProjectLogoAsset, setSelectedProjectLogoAsset, editableProjectLogoNotes, setEditableProjectLogoNotes, compiled, shownPrompt, projectScaffoldPreview, documentChunks, selectedDocumentChunk, isContentDirty, isDocumentLike, isImageOutput, inferredGeneratedCategory, selectedGeneratedCategory, setSelectedGeneratedCategory, uploadCategory, setUploadCategory, generatedFiles, setGeneratedFiles, selectedGeneratedFileId, setSelectedGeneratedFileId, generatedSearch, setGeneratedSearch, selectedGeneratedVersion, setSelectedGeneratedVersion, selectedGeneratedFileIds, setSelectedGeneratedFileIds, isExportingGeneratedContent, setIsExportingGeneratedContent, isRenderingDocument, setIsRenderingDocument, targetFolder, setTargetFolder, isAssistModalOpen, setIsAssistModalOpen, assistTargetVersion, setAssistTargetVersion, assistRunStartedAt, setAssistRunStartedAt, assistSavedFile, setAssistSavedFile, assistError, setAssistError, isImportingAssistDownload, setIsImportingAssistDownload, assistCopiedPrompt, setAssistCopiedPrompt, assistCopiedFilename, setAssistCopiedFilename, assistChatGptOpened, setAssistChatGptOpened, assistUploadFile, setAssistUploadFile, distributionPrefill, setDistributionPrefill, refreshGeneratedFiles, refreshTargetFolder, versionOptions, filteredGeneratedFiles, exportableGeneratedImages, selectedExportFiles, selectedGeneratedFile, selectedRecipe, selectedVariant, variantPrompt, batchEligibleEntries, batchPromptItems, brandQaScorecard, masterFrameMetadata, styleMemoryPrompt, documentAssemblyPrompt, handleSaveContentSource, handleSaveProjectChrome } = scope;
  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied.`);
    } catch {
      showToast("Clipboard copy failed. Select and copy manually.", "warning");
    }
  }

  async function handleCopyOutputFilename() {
    await copyToClipboard(copyableFilename(customOutputFilename || suggestedOutputFilename), "Filename without extension");
  }

  function openProjectWizard() {
    const draft = newProjectDraft(selectedBrand || brandList[0]);
    setProjectDraft(draft);
    setProjectWizardStep(1);
    setProjectCreateError("");
    setIsProjectWizardOpen(true);
  }

  async function handleUpdateStorageRoot(initialize = false) {
    try {
      const status = await updateStorageRoot(storageRoot.trim(), initialize);
      setStorageRoot(status.contentRoot || storageRoot);
      setStorageState(status.writable ? "available" : "read-only");
      await refreshRuntimeRepository();
      showToast(initialize ? "Content root initialized." : "Content root updated.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update content root.", "warning");
    }
  }

  async function handleCreateProject() {
    setProjectCreateError("");
    setIsCreatingProject(true);
    try {
      const result = await createProject(projectDraft);
      const key = `${result.project.brandId}/${result.project.id}`;
      setRuntimeProjects((current) => [result.project, ...current.filter((item) => `${item.brandId}/${item.id}` !== key)]);
      setRuntimeFilesByProject((current) => ({ ...current, [key]: result.files }));
      setSelectedBrandId(result.project.brandId);
      setSelectedProjectId(result.project.id);
      setIsProjectWizardOpen(false);
      showToast(`Created ${result.project.label}.`);
    } catch (error) {
      setProjectCreateError(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleCopyPromptAndOpenChatGPT() {
    await copyToClipboard(compiled.productionPrompt, "Production prompt");
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }





  function handleDownloadPromptFile() {
    const promptFilename = replaceExtension(customOutputFilename || suggestedOutputFilename, "txt");
    const blob = new Blob([compiled.productionPrompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = promptFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadDocumentMarkdownFile() {
    const sourceFilename = selectedContentEntry?.filename || replaceExtension(customOutputFilename || suggestedOutputFilename, "md");
    const blob = new Blob([editableMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sourceFilename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${sourceFilename}.`);
  }

  async function handleCopySourceMarkdownFile() {
    const label = selectedOutputProfile?.outputType === "image"
      ? "Visual MD"
      : isDocumentLike
        ? "Document MD"
        : "Source MD";
    if (!selectedContentEntry) {
      showToast(`No ${label.toLowerCase()} source file is selected.`, "warning");
      return;
    }

    try {
      const response = await copyContentFileToClipboard(selectedContentEntry.path);
      if (!response.ok) {
        showToast(response.error || `Could not copy the ${label} file.`, "warning");
        return;
      }
      showToast(`${label} file copied. Paste it into ChatGPT to attach it.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Could not copy the ${label} file.`, "warning");
    }
  }

  async function handleCopyLogoFile() {
    if (!resolvedLogoAssetPath) {
      showToast("No logo file is resolved for this content.", "warning");
      return;
    }

    try {
      const response = await copyContentFileToClipboard(resolvedLogoAssetPath);
      if (!response.ok) {
        showToast(response.error || "Could not copy the logo file.", "warning");
        return;
      }
      showToast("Logo file copied. Paste it into ChatGPT to attach it.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not copy the logo file.", "warning");
    }
  }

  async function handleCopyLinkedInPostText() {
    const postText = compiled.promptPreview.linkedinPostText ?? "";
    if (!postText.trim()) {
      showToast("No LinkedIn Post Text found in this source.", "warning");
      return;
    }
    await copyToClipboard(postText, "LinkedIn Post Text");
  }

  function handleDownloadBodyContentFile() {
    const body = compiled.documentPromptParts?.bodyContent ?? "";
    if (!body.trim()) {
      showToast("No Body Content found for this document.", "warning");
      return;
    }

    const bodyFilename = replaceExtension(customOutputFilename || suggestedOutputFilename, "body.md");
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = bodyFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleGeneratedFileSelection(fileId: string) {
    setSelectedGeneratedFileIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId]
    );
  }

  function selectAllGeneratedImagesInVersion() {
    setSelectedGeneratedFileIds(exportableGeneratedImages.map((file) => file.id));
  }

  function clearGeneratedImageSelection() {
    setSelectedGeneratedFileIds([]);
  }

  function toggleBatchContentPath(path: string) {
    setSelectedBatchContentPaths((current) =>
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path]
    );
  }

  function selectAllBatchContent() {
    setSelectedBatchContentPaths(batchEligibleEntries.map((entry) => entry.path));
  }

  function toggleApprovedGeneratedFile(fileId: string) {
    setApprovedGeneratedFileIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId]
    );
  }

  async function handleCopyVariantPrompt() {
    await copyToClipboard(variantPrompt, `${selectedVariant.label} variant prompt`);
  }

  async function handleCopyBatchRunManifest() {
    if (batchPromptItems.length === 0) {
      showToast("Select at least one content file for the batch queue.", "warning");
      return;
    }

    await copyToClipboard(buildBatchRunManifest(batchPromptItems), "Batch generation queue");
  }

  async function handleCopyStyleMemory() {
    await copyToClipboard(styleMemoryPrompt, "Project style memory");
  }

  async function handleCopyDocumentAssemblyPrompt() {
    if (!documentAssemblyPrompt.trim()) {
      showToast("No document assembly prompt is available for this project.", "warning");
      return;
    }

    await copyToClipboard(documentAssemblyPrompt, "Document assembly prompt");
  }

  async function handleExportGeneratedContent(format: "pptx" | "pdf") {
    if (!selectedProject) return;

    if (selectedExportFiles.length === 0) {
      showToast("Select at least one PNG or JPEG visual to export.", "warning");
      return;
    }

    setIsExportingGeneratedContent(true);

    try {
      const response = await exportProjectGeneratedContent({
        projectFolder: selectedProject.folder,
        fileIds: selectedExportFiles.map((file) => file.id),
        format,
        category: "visuals",
        contentSet: selectedContentSet,
        versionLabel: selectedGeneratedVersion,
        outputFilename: getDeliveryPackFilenameBase({
          brandLabel: selectedBrand?.label,
          projectLabel: selectedProject.label,
          contentSetLabel: selectedContentSet,
          versionLabel: selectedGeneratedVersion || "generated-visuals",
        }),
      });

      if (!response.ok || !response.fileUrl) {
        showToast(response.error || "Export failed.", "warning");
        return;
      }

      await refreshGeneratedFiles();
      showToast(`Exported ${response.filename}.`);
      window.open(response.fileUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not export selected visuals.", "warning");
    } finally {
      setIsExportingGeneratedContent(false);
    }
  }

  async function handleRenderLockedDocument() {
    if (!selectedProject || !isDocumentLike) return;
    setIsRenderingDocument(true);
    try {
      const response = await renderProjectDocument({
        projectFolder: selectedProject.folder,
        outputProfileId: selectedOutputProfile.id as "a4_document_portrait" | "a4_pdf_portrait",
        outputFilename: customOutputFilename || suggestedOutputFilename,
        title: selectedContentEntry?.label || selectedProject.label,
        markdown: compiled.promptPreview.bodyContent || editableMarkdown,
        headerText: masterFrameMetadata.headerText,
        footerText: masterFrameMetadata.footerText,
        logoAsset: masterFrameMetadata.logoAsset,
        contentSet: selectedContentSet,
      });
      if (!response.ok) {
        showToast(response.error || "Document rendering failed.", "warning");
        return;
      }
      setSelectedGeneratedCategory("documents");
      await refreshGeneratedFiles();
      showToast(`Rendered ${response.filename} with the locked master frame.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not render the document.", "warning");
    } finally {
      setIsRenderingDocument(false);
    }
  }

  async function copyTextToClipboard(text: string, successMessage: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, "info");
      return true;
    } catch {
      showToast("Could not copy automatically. Select and copy it manually.", "warning");
      return false;
    }
  }

  async function openAssistModal() {
    const defaultVersion = getDefaultAssistVersionLabel({
      generatedFiles,
    });
    setAssistTargetVersion(normalizeAssistVersionLabel(defaultVersion));
    setAssistRunStartedAt(new Date().toISOString());
    setAssistSavedFile(null);
    setAssistError("");
    setAssistCopiedPrompt(false);
    setAssistCopiedFilename(false);
    setAssistChatGptOpened(false);
    setAssistUploadFile(null);
    setIsAssistModalOpen(true);

    const copied = await copyTextToClipboard(compiled.productionPrompt, "Prompt copied. Open ChatGPT when ready.");
    setAssistCopiedPrompt(copied);
  }

  async function handleAssistCopyPrompt() {
    const copied = await copyTextToClipboard(compiled.productionPrompt, "Prompt copied.");
    setAssistCopiedPrompt(copied);
  }

  async function handleAssistCopyFilename() {
    const copied = await copyTextToClipboard(
      copyableFilename(customOutputFilename || suggestedOutputFilename),
      "Filename copied without extension."
    );
    setAssistCopiedFilename(copied);
  }

  function handleOpenChatGptAssist() {
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    setAssistChatGptOpened(true);
  }

  async function handleImportLatestChatGptDownload() {
    if (!selectedProject) return;

    const payload = {
      projectFolder: selectedProject.folder,
      contentSet: selectedContentSet,
      outputFilename: normalizeAssistImageFilename(customOutputFilename || suggestedOutputFilename),
      versionLabel: normalizeAssistVersionLabel(assistTargetVersion),
      runStartedAt: assistRunStartedAt || new Date().toISOString(),
      masterFrame: masterFrameMetadata,
    };
    const validationErrors = validateAssistImportInput(payload);

    if (validationErrors.length > 0) {
      showToast(validationErrors.join(" "), "warning");
      return;
    }

    setIsImportingAssistDownload(true);
    setAssistError("");

    try {
      const response = await importLatestChatGptDownload(payload);
      if (!response.ok) {
        setAssistError(response.error || "Could not import the latest download.");
        showToast(response.error || "Could not import the latest download.", "warning");
        return;
      }

      setAssistSavedFile(response);
      setSelectedGeneratedCategory("visuals");
      setSelectedGeneratedVersion(payload.versionLabel);
      await refreshGeneratedFiles();
      showToast(`Imported ${response.filename}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not import the latest download.";
      setAssistError(message);
      showToast(message, "warning");
    } finally {
      setIsImportingAssistDownload(false);
    }
  }

  async function handleAssistManualUpload() {
    if (!selectedProject || !assistUploadFile) {
      showToast("Choose the downloaded image first.", "warning");
      return;
    }

    const versionLabel = normalizeAssistVersionLabel(assistTargetVersion);
    const uploadExtension = assistUploadFile.name.match(/\.(png|jpe?g|webp)$/i)?.[0] || ".png";

    try {
      const response = await uploadProjectGeneratedContent({
        projectFolder: selectedProject.folder,
        category: "visuals",
        contentSet: selectedContentSet,
        file: assistUploadFile,
        targetFilename: normalizeAssistImageFilename(customOutputFilename || suggestedOutputFilename, uploadExtension),
        versionLabel,
        masterFrame: masterFrameMetadata,
      });

      if (!response.ok) {
        setAssistError(response.error || "Upload failed.");
        showToast(response.error || "Upload failed.", "warning");
        return;
      }

      setAssistUploadFile(null);
      setAssistSavedFile(response);
      setSelectedGeneratedCategory("visuals");
      setSelectedGeneratedVersion(versionLabel);
      await refreshGeneratedFiles();
      showToast(`Saved ${response.filename}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save uploaded image.";
      setAssistError(message);
      showToast(message, "warning");
    }
  }

  const resolvedLogoAssetPath = compiled.promptPreview.logoAsset || selectedProjectLogoAsset || selectedBrand?.logoAsset || "";
  const logoPreviewPath =
    brandLogoAssets.find((asset) => asset.path === resolvedLogoAssetPath)?.previewPath ||
    selectedBrand?.logoPreviewPath ||
    selectedBrand?.logoPath ||
    `/brands/${selectedBrand?.id}/${selectedBrand?.id}-logo.svg`;


  return { ...scope, copyToClipboard, handleCopyOutputFilename, openProjectWizard, handleUpdateStorageRoot, handleCreateProject, handleCopyPromptAndOpenChatGPT, handleDownloadPromptFile, handleDownloadDocumentMarkdownFile, handleCopySourceMarkdownFile, handleCopyLogoFile, handleCopyLinkedInPostText, handleDownloadBodyContentFile, toggleGeneratedFileSelection, selectAllGeneratedImagesInVersion, clearGeneratedImageSelection, toggleBatchContentPath, selectAllBatchContent, toggleApprovedGeneratedFile, handleCopyVariantPrompt, handleCopyBatchRunManifest, handleCopyStyleMemory, handleCopyDocumentAssemblyPrompt, handleExportGeneratedContent, handleRenderLockedDocument, copyTextToClipboard, openAssistModal, handleAssistCopyPrompt, handleAssistCopyFilename, handleOpenChatGptAssist, handleImportLatestChatGptDownload, handleAssistManualUpload, resolvedLogoAssetPath, logoPreviewPath };
}
