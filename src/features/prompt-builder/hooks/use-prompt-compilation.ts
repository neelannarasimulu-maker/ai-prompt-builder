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


import type { useSourceEditing } from "./use-source-editing";

export function usePromptCompilation(scope: ReturnType<typeof useSourceEditing>) {
  const { brandList, profileList, setRuntimeProjects, setRuntimeFilesByProject, projectList, storageRoot, setStorageRoot, storageState, setStorageState, localWritesAvailable, selectedBrandId, setSelectedBrandId, filteredProjects, selectedProjectId, setSelectedProjectId, selectedBrand, selectedProject, refreshRuntimeRepository, activeRuntimeFiles, allProjectContent, session, selectedContentType, setSelectedContentType, selectedContentSet, setSelectedContentSet, selectedContentPath, setSelectedContentPath, editableMarkdown, setEditableMarkdown, savedMarkdownByPath, setSavedMarkdownByPath, selectedOutputProfileId, setSelectedOutputProfileId, selectedLayoutPresetId, setSelectedLayoutPresetId, selectedBackgroundPresetId, setSelectedBackgroundPresetId, selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId, selectedBackgroundTheme, setSelectedBackgroundTheme, promptView, setPromptView, selectedDocumentChunkIndex, setSelectedDocumentChunkIndex, customOutputFilename, setCustomOutputFilename, workflowMode, setWorkflowMode, selectedRecipeId, setSelectedRecipeId, selectedVariantId, setSelectedVariantId, selectedBatchContentPaths, setSelectedBatchContentPaths, approvedGeneratedFileIds, setApprovedGeneratedFileIds, toasts, showToast, isProjectWizardOpen, setIsProjectWizardOpen, projectWizardStep, setProjectWizardStep, projectDraft, setProjectDraft, projectCreateError, setProjectCreateError, isCreatingProject, setIsCreatingProject, contentTypes, contentSets, visibleContentFiles, selectedContentEntry, selectedOutputProfile, suggestedOutputFilename, brandRules, headerRules, footerRules, logoRules, typographyRules, documentRules, tableRules, brandVisualRules, runtimeMarkdown, activeProjectFile, projectRules, projectHeaderPath, projectFooterPath, projectLogoPath, projectHeaderSource, projectFooterSource, projectLogoSource, projectVisualRules, projectDocumentRules, visualRules, logoSourceText, brandLogoAssets, editableProjectHeader, setEditableProjectHeader, editableProjectFooter, setEditableProjectFooter, editableProjectLogo, setEditableProjectLogo, selectedProjectLogoAsset, setSelectedProjectLogoAsset, editableProjectLogoNotes, setEditableProjectLogoNotes } = scope;
  const compiled = useMemo(() => {
    if (!selectedBrand || !selectedProject || !selectedOutputProfile) {
      return {
        productionPrompt: "",
        debugPrompt: "",
        actionPrompt: "",
        contractPrompt: "",
        warnings: ["Please select a brand, project and output profile."],
        promptLint: emptyPromptLint(),
        fidelityScore: 0,
        promptPreview: emptyPromptPreview(),
        sections: {},
        dynamicLayoutPlan: null,
        renderContract: null,
        resolvedLayoutPreset: getLayoutPreset("auto"),
        resolvedBackgroundPreset: getBackgroundPreset("auto"),
        resolvedDocumentBackgroundPreset: getDocumentBackgroundPreset("clean_white_form"),
        documentPromptParts: { runPrompt: "", sourceMarkdown: "", attachmentPrompt: "", instructionsPrompt: "", inlinePrompt: "", inlineFullPrompt: "", bodyContent: "", bodyChunks: [], fullPrompt: "" },
        promptStats: { characters: 0, words: 0, visibleTextLines: 0 },
      };
    }

    try {
      return compilePrompt({
        brandId: selectedBrand.id,
        brandLabel: selectedBrand.label,
        projectLabel: selectedProject.label,
        contentLabel: selectedContentEntry?.label ?? "Untitled Content",
        contentType: selectedContentType || "content",
        outputProfile: selectedOutputProfile,
        logoAsset:
          selectedBrand.logoAsset ||
          `content/brands/${selectedBrand.id}/assets/${selectedBrand.id}-logo.svg`,
        brandLogoAssets: brandLogoAssets.map((asset) => asset.path),
        logoSourceText,
        brandRules,
        headerRules,
        footerRules,
        projectHeaderRules: editableProjectHeader,
        projectFooterRules: editableProjectFooter,
        projectLogoRules: editableProjectLogo,
        logoRules,
        typographyRules,
        documentRules,
        projectDocumentRules,
        tableRules,
        projectRules,
        visualRules,
        contentMarkdown: editableMarkdown,
        contentFilename: selectedContentEntry?.filename,
        layoutPresetId: selectedLayoutPresetId,
        backgroundPresetId: selectedBackgroundPresetId,
        documentBackgroundPresetId: selectedDocumentBackgroundPresetId,
        backgroundTheme: selectedBackgroundTheme,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown prompt compiler error";
      return {
        productionPrompt: "",
        debugPrompt: `Prompt compiler failed:\n${message}`,
        actionPrompt: "Fix the content/source error shown in Debug, then refresh.",
        contractPrompt: "",
        warnings: [`Prompt compiler error: ${message}`],
        promptLint: emptyPromptLint(),
        fidelityScore: 0,
        promptPreview: emptyPromptPreview(),
        sections: {},
        dynamicLayoutPlan: null,
        renderContract: null,
        resolvedLayoutPreset: getLayoutPreset("auto"),
        resolvedBackgroundPreset: getBackgroundPreset("auto"),
        resolvedDocumentBackgroundPreset: getDocumentBackgroundPreset("clean_white_form"),
        documentPromptParts: { runPrompt: "", sourceMarkdown: "", attachmentPrompt: "", instructionsPrompt: "", inlinePrompt: "", inlineFullPrompt: "", bodyContent: "", bodyChunks: [], fullPrompt: "" },
        promptStats: { characters: 0, words: 0, visibleTextLines: 0 },
      };
    }
  }, [
    selectedBrand,
    selectedProject,
    selectedOutputProfile,
    selectedContentEntry,
    selectedContentType,
    brandRules,
    headerRules,
    footerRules,
    editableProjectHeader,
    editableProjectFooter,
    editableProjectLogo,
    brandLogoAssets,
    logoRules,
    typographyRules,
    documentRules,
    projectDocumentRules,
    tableRules,
    projectRules,
    visualRules,
    logoSourceText,
    editableMarkdown,
    selectedLayoutPresetId,
    selectedBackgroundPresetId,
    selectedDocumentBackgroundPresetId,
    selectedBackgroundTheme,
  ]);

  const shownPrompt =
    promptView === "production"
      ? compiled.productionPrompt
      : promptView === "debug"
        ? compiled.debugPrompt
        : promptView === "actions"
          ? compiled.actionPrompt
          : compiled.contractPrompt;

  const projectScaffoldPreview = useMemo(() => buildProjectScaffold(projectDraft), [projectDraft]);

  const documentChunks = compiled.documentPromptParts?.bodyChunks ?? [];
  const selectedDocumentChunk = documentChunks[selectedDocumentChunkIndex] ?? documentChunks[0] ?? null;

  useEffect(() => {
    if (documentChunks.length === 0 && selectedDocumentChunkIndex !== 0) {
      setSelectedDocumentChunkIndex(0);
      return;
    }

    if (documentChunks.length > 0 && selectedDocumentChunkIndex > documentChunks.length - 1) {
      setSelectedDocumentChunkIndex(0);
    }
  }, [documentChunks.length, selectedDocumentChunkIndex, setSelectedDocumentChunkIndex]);

  const isContentDirty = selectedContentEntry ? editableMarkdown !== selectedContentEntry.raw : false;
  const isDocumentLike = selectedOutputProfile?.outputType === "document" || selectedOutputProfile?.outputType === "pdf";
  const isImageOutput = selectedOutputProfile?.outputType === "image";


  return { ...scope, compiled, shownPrompt, projectScaffoldPreview, documentChunks, selectedDocumentChunk, isContentDirty, isDocumentLike, isImageOutput };
}
