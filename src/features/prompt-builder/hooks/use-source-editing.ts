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


  return { ...scope, brandRules, headerRules, footerRules, logoRules, typographyRules, documentRules, tableRules, brandVisualRules, runtimeMarkdown, activeProjectFile, projectRules, projectHeaderPath, projectFooterPath, projectLogoPath, projectHeaderSource, projectFooterSource, projectLogoSource, projectVisualRules, projectDocumentRules, visualRules, logoSourceText, brandLogoAssets, editableProjectHeader, setEditableProjectHeader, editableProjectFooter, setEditableProjectFooter, editableProjectLogo, setEditableProjectLogo, selectedProjectLogoAsset, setSelectedProjectLogoAsset, editableProjectLogoNotes, setEditableProjectLogoNotes };
}
