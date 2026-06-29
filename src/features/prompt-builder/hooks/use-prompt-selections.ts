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

import { useModalState } from "./use-modal-state";
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




export function usePromptSelections() {

  const brandList = listStaticBrands();
  const profileList = outputProfiles as OutputProfileItem[];
  const {
    setRuntimeProjects, setRuntimeFilesByProject, projectList, storageRoot, setStorageRoot,
    storageState, setStorageState, browserFsAvailable, workspaceKind, localWritesAvailable, selectedBrandId, setSelectedBrandId,
    filteredProjects, selectedProjectId, setSelectedProjectId, selectedBrand, selectedProject,
    refreshRuntimeRepository, activeRuntimeFiles, allProjectContent,
  } = useProjectWorkspace(brandList);
  const session = usePromptBuilderSession();
  const {
    selectedContentType, setSelectedContentType, selectedContentSet, setSelectedContentSet,
    selectedContentPath, setSelectedContentPath, editableMarkdown, setEditableMarkdown,
    savedMarkdownByPath, setSavedMarkdownByPath, selectedOutputProfileId, setSelectedOutputProfileId,
    selectedLayoutPresetId, setSelectedLayoutPresetId, selectedBackgroundPresetId, setSelectedBackgroundPresetId,
    selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId, selectedBackgroundTheme, setSelectedBackgroundTheme,
    promptView, setPromptView, selectedDocumentChunkIndex, setSelectedDocumentChunkIndex,
    customOutputFilename, setCustomOutputFilename, workflowMode, setWorkflowMode,
    selectedRecipeId, setSelectedRecipeId, selectedVariantId, setSelectedVariantId,
    selectedBatchContentPaths, setSelectedBatchContentPaths, approvedGeneratedFileIds, setApprovedGeneratedFileIds,
  } = session;

  const { toasts, showToast } = useToasts();
  const modalState = useModalState(brandList);
  const { isProjectWizardOpen, setIsProjectWizardOpen, projectWizardStep, setProjectWizardStep, projectDraft, setProjectDraft, projectCreateError, setProjectCreateError, isCreatingProject, setIsCreatingProject } = modalState;


  const contentTypes = useMemo(
    () => Array.from(new Set(allProjectContent.map((entry) => entry.type))),
    [allProjectContent]
  );

  useEffect(() => {
    if (!contentTypes.includes(selectedContentType)) {
      setSelectedContentType(contentTypes[0] ?? "");
    }
  }, [contentTypes, selectedContentType, setSelectedContentType]);

  const contentSets = useMemo(
    () => Array.from(new Set(allProjectContent
      .filter((entry) => entry.type === selectedContentType)
      .map((entry) => entry.contentSet))),
    [allProjectContent, selectedContentType]
  );

  useEffect(() => {
    if (!contentSets.includes(selectedContentSet)) setSelectedContentSet(contentSets[0] ?? "");
  }, [contentSets, selectedContentSet, setSelectedContentSet]);

  const visibleContentFiles = useMemo(
    () => allProjectContent.filter((entry) => entry.type === selectedContentType && entry.contentSet === selectedContentSet),
    [allProjectContent, selectedContentType, selectedContentSet]
  );

  useEffect(() => {
    if (!visibleContentFiles.find((entry) => entry.path === selectedContentPath)) {
      setSelectedContentPath(visibleContentFiles[0]?.path ?? "");
    }
  }, [visibleContentFiles, selectedContentPath, setSelectedContentPath]);

  const selectedContentEntry = useMemo(
    () => visibleContentFiles.find((entry) => entry.path === selectedContentPath) ?? null,
    [visibleContentFiles, selectedContentPath]
  );

  useEffect(() => {
    const savedVersion = selectedContentEntry ? savedMarkdownByPath[selectedContentEntry.path] : undefined;
    setEditableMarkdown(savedVersion ?? selectedContentEntry?.raw ?? "");
  }, [selectedContentEntry, savedMarkdownByPath]);

  const selectedOutputProfile = useMemo(
    () => profileList.find((profile) => profile.id === selectedOutputProfileId) ?? profileList[0],
    [profileList, selectedOutputProfileId]
  );

  useEffect(() => {
    if (!profileList.find((profile) => profile.id === selectedOutputProfileId)) {
      const migratedLinkedInProfile = ["linkedin_image_4_5", "linkedin_carousel_4_5"].includes(selectedOutputProfileId)
        ? "linkedin_asset_4_5"
        : "";
      setSelectedOutputProfileId(migratedLinkedInProfile || profileList[0]?.id || "landscape_image_16_9");
    }
  }, [profileList, selectedOutputProfileId, setSelectedOutputProfileId]);

  useEffect(() => {
    if (!documentBackgroundPresets.find((preset) => preset.id === selectedDocumentBackgroundPresetId)) {
      setSelectedDocumentBackgroundPresetId("auto_brand_document");
    }
  }, [selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId]);

  const suggestedOutputFilename = useMemo(
    () => getSuggestedOutputFilename({
      contentPath: selectedContentEntry?.path,
      contentFilename: selectedContentEntry?.filename,
      outputProfileId: selectedOutputProfile?.id,
      outputType: selectedOutputProfile?.outputType,
      category: selectedContentType,
    }),
    [selectedContentEntry, selectedOutputProfile, selectedContentType]
  );

  useEffect(() => {
    setCustomOutputFilename(suggestedOutputFilename);
  }, [suggestedOutputFilename, setCustomOutputFilename]);


  return { brandList, profileList, setRuntimeProjects, setRuntimeFilesByProject, projectList, storageRoot, setStorageRoot, storageState, setStorageState, browserFsAvailable, workspaceKind, localWritesAvailable, selectedBrandId, setSelectedBrandId, filteredProjects, selectedProjectId, setSelectedProjectId, selectedBrand, selectedProject, refreshRuntimeRepository, activeRuntimeFiles, allProjectContent, session, selectedContentType, setSelectedContentType, selectedContentSet, setSelectedContentSet, selectedContentPath, setSelectedContentPath, editableMarkdown, setEditableMarkdown, savedMarkdownByPath, setSavedMarkdownByPath, selectedOutputProfileId, setSelectedOutputProfileId, selectedLayoutPresetId, setSelectedLayoutPresetId, selectedBackgroundPresetId, setSelectedBackgroundPresetId, selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId, selectedBackgroundTheme, setSelectedBackgroundTheme, promptView, setPromptView, selectedDocumentChunkIndex, setSelectedDocumentChunkIndex, customOutputFilename, setCustomOutputFilename, workflowMode, setWorkflowMode, selectedRecipeId, setSelectedRecipeId, selectedVariantId, setSelectedVariantId, selectedBatchContentPaths, setSelectedBatchContentPaths, approvedGeneratedFileIds, setApprovedGeneratedFileIds, toasts, showToast, isProjectWizardOpen, setIsProjectWizardOpen, projectWizardStep, setProjectWizardStep, projectDraft, setProjectDraft, projectCreateError, setProjectCreateError, isCreatingProject, setIsCreatingProject, contentTypes, contentSets, visibleContentFiles, selectedContentEntry, selectedOutputProfile, suggestedOutputFilename };
}
