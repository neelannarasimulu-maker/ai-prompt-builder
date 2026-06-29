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


import type { useAutomationCoordination } from "./use-automation-coordination";
import { PromptReviewService } from "../../../review/prompt-review-service";
import { useFeatureFlag } from "../../../ui/hooks/use-feature-flag";
import { usePromptReviewSnapshots } from "./use-prompt-review-snapshots";

const promptReviewService = new PromptReviewService();

export function useReviewCoordination(scope: ReturnType<typeof useAutomationCoordination>) {
  const { brandList, profileList, setRuntimeProjects, setRuntimeFilesByProject, projectList, storageRoot, setStorageRoot, storageState, setStorageState, localWritesAvailable, selectedBrandId, setSelectedBrandId, filteredProjects, selectedProjectId, setSelectedProjectId, selectedBrand, selectedProject, refreshRuntimeRepository, activeRuntimeFiles, allProjectContent, session, selectedContentType, setSelectedContentType, selectedContentSet, setSelectedContentSet, selectedContentPath, setSelectedContentPath, editableMarkdown, setEditableMarkdown, savedMarkdownByPath, setSavedMarkdownByPath, selectedOutputProfileId, setSelectedOutputProfileId, selectedLayoutPresetId, setSelectedLayoutPresetId, selectedBackgroundPresetId, setSelectedBackgroundPresetId, selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId, selectedBackgroundTheme, setSelectedBackgroundTheme, promptView, setPromptView, selectedDocumentChunkIndex, setSelectedDocumentChunkIndex, customOutputFilename, setCustomOutputFilename, workflowMode, setWorkflowMode, selectedRecipeId, setSelectedRecipeId, selectedVariantId, setSelectedVariantId, selectedBatchContentPaths, setSelectedBatchContentPaths, approvedGeneratedFileIds, setApprovedGeneratedFileIds, toasts, showToast, isProjectWizardOpen, setIsProjectWizardOpen, projectWizardStep, setProjectWizardStep, projectDraft, setProjectDraft, projectCreateError, setProjectCreateError, isCreatingProject, setIsCreatingProject, contentTypes, contentSets, visibleContentFiles, selectedContentEntry, selectedOutputProfile, suggestedOutputFilename, brandRules, headerRules, footerRules, logoRules, typographyRules, documentRules, tableRules, brandVisualRules, runtimeMarkdown, activeProjectFile, projectRules, projectHeaderPath, projectFooterPath, projectLogoPath, projectHeaderSource, projectFooterSource, projectLogoSource, projectVisualRules, projectDocumentRules, visualRules, logoSourceText, brandLogoAssets, editableProjectHeader, setEditableProjectHeader, editableProjectFooter, setEditableProjectFooter, editableProjectLogo, setEditableProjectLogo, selectedProjectLogoAsset, setSelectedProjectLogoAsset, editableProjectLogoNotes, setEditableProjectLogoNotes, compiled, shownPrompt, projectScaffoldPreview, documentChunks, selectedDocumentChunk, isContentDirty, isDocumentLike, isImageOutput, inferredGeneratedCategory, selectedGeneratedCategory, setSelectedGeneratedCategory, uploadCategory, setUploadCategory, generatedFiles, setGeneratedFiles, selectedGeneratedFileId, setSelectedGeneratedFileId, generatedSearch, setGeneratedSearch, selectedGeneratedVersion, setSelectedGeneratedVersion, selectedGeneratedFileIds, setSelectedGeneratedFileIds, isExportingGeneratedContent, setIsExportingGeneratedContent, isRenderingDocument, setIsRenderingDocument, targetFolder, setTargetFolder, isAssistModalOpen, setIsAssistModalOpen, assistTargetVersion, setAssistTargetVersion, assistRunStartedAt, setAssistRunStartedAt, assistSavedFile, setAssistSavedFile, assistError, setAssistError, isImportingAssistDownload, setIsImportingAssistDownload, assistCopiedPrompt, setAssistCopiedPrompt, assistCopiedFilename, setAssistCopiedFilename, assistChatGptOpened, setAssistChatGptOpened, assistUploadFile, setAssistUploadFile } = scope;
  useEffect(() => {
    if (!generatedContentCategories.some((category) => category.id === selectedGeneratedCategory)) {
      setSelectedGeneratedCategory(inferredGeneratedCategory);
    }
    if (!generatedContentCategories.some((category) => category.id === uploadCategory)) {
      setUploadCategory(inferredGeneratedCategory);
    }
  }, [selectedGeneratedCategory, uploadCategory, inferredGeneratedCategory, setSelectedGeneratedCategory, setUploadCategory]);
  const [distributionPrefill, setDistributionPrefill] = useState<DistributionPrefill | null>(null);

  useEffect(() => {
    if (!selectedGeneratedCategory) setSelectedGeneratedCategory(inferredGeneratedCategory);
    if (!uploadCategory) setUploadCategory(inferredGeneratedCategory);
  }, [inferredGeneratedCategory, selectedGeneratedCategory, uploadCategory, setSelectedGeneratedCategory, setUploadCategory]);

  async function refreshGeneratedFiles(showSuccess = false) {
    if (!selectedProject) return;

    try {
      const result = await listProjectGeneratedContent({
        projectFolder: selectedProject.folder,
        category: selectedGeneratedCategory,
        contentSet: selectedGeneratedCategory === "all" ? undefined : selectedContentSet,
      });
      setGeneratedFiles(result.files.map(enrichGeneratedContentFile));
      if (showSuccess) showToast(`Found ${result.files.length} file(s).`, "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not list generated content.", "warning");
    }
  }

  async function refreshTargetFolder() {
    if (!selectedProject) return;

    try {
      const result = await getProjectGeneratedContentFolder({
        projectFolder: selectedProject.folder,
        category: uploadCategory,
        contentSet: selectedContentSet,
      });
      setTargetFolder(result.folder);
    } catch {
      setTargetFolder("");
    }
  }

  useEffect(() => {
    refreshGeneratedFiles();
  }, [selectedProjectId, selectedGeneratedCategory, selectedContentSet]);

  useEffect(() => {
    refreshTargetFolder();
  }, [selectedProjectId, uploadCategory, selectedContentSet]);

  const versionOptions = useMemo(() => {
    const versions = new Set<string>();

    for (const file of generatedFiles) {
      versions.add(file.versionLabel || "Unversioned");
    }

    return Array.from(versions).sort((a, b) => {
      const sortValue = getGeneratedVersionSortValue(b) - getGeneratedVersionSortValue(a);
      return sortValue || a.localeCompare(b);
    });
  }, [generatedFiles, selectedGeneratedCategory]);

  useEffect(() => {
    if (versionOptions.length === 0) {
      if (selectedGeneratedVersion) setSelectedGeneratedVersion("");
      return;
    }

    if (!selectedGeneratedVersion || !versionOptions.includes(selectedGeneratedVersion)) {
      setSelectedGeneratedVersion(versionOptions[0]);
    }
  }, [versionOptions, selectedGeneratedVersion, setSelectedGeneratedVersion]);

  useEffect(() => {
    if (!assistTargetVersion || (assistTargetVersion !== "v001" && !versionOptions.includes(assistTargetVersion))) {
      setAssistTargetVersion(getDefaultAssistVersionLabel({
        selectedGeneratedVersion,
        generatedFiles,
      }));
    }
  }, [assistTargetVersion, generatedFiles, selectedGeneratedVersion, setAssistTargetVersion, versionOptions]);

  const filteredGeneratedFiles = useMemo(() => {
    const query = generatedSearch.trim().toLowerCase();

    return generatedFiles.filter((file) => {
      const matchesCategory =
        selectedGeneratedCategory === "all" || file.category === selectedGeneratedCategory;
      const matchesVersion =
        selectedGeneratedCategory === "all" ||
        !selectedGeneratedVersion ||
        (file.versionLabel || "Unversioned") === selectedGeneratedVersion;

      if (!matchesCategory) return false;
      if (!matchesVersion) return false;
      if (!query) return true;

      return [
        file.filename,
        file.displayName,
        file.versionLabel || "Unversioned",
        file.routePath || file.relativePath,
        file.projectRelativePath || file.generatedRelativePath,
        file.fileType,
        file.category,
      ].join(" ").toLowerCase().includes(query);
    }).sort((a, b) => {
      const versionCompare = generatedFileCollator.compare(
        a.versionLabel || "Unversioned",
        b.versionLabel || "Unversioned"
      );
      if (versionCompare !== 0) return versionCompare;

      return generatedFileCollator.compare(
        a.displayName || basenameWithoutExtension(a.filename),
        b.displayName || basenameWithoutExtension(b.filename)
      );
    });
  }, [generatedFiles, generatedSearch, selectedGeneratedCategory, selectedGeneratedVersion]);

  const exportableGeneratedImages = useMemo(
    () => filteredGeneratedFiles.filter((file) => file.fileType === "image" && /\.(png|jpe?g)$/i.test(file.filename)),
    [filteredGeneratedFiles]
  );

  const selectedExportFiles = useMemo(
    () => exportableGeneratedImages.filter((file) => selectedGeneratedFileIds.includes(file.id)),
    [exportableGeneratedImages, selectedGeneratedFileIds]
  );

  useEffect(() => {
    setSelectedGeneratedFileIds((current) =>
      current.filter((id) => exportableGeneratedImages.some((file) => file.id === id))
    );
  }, [exportableGeneratedImages, setSelectedGeneratedFileIds]);

  useEffect(() => {
    if (selectedGeneratedFileId && filteredGeneratedFiles.some((file) => file.id === selectedGeneratedFileId)) return;
    setSelectedGeneratedFileId(filteredGeneratedFiles[0]?.id ?? "");
  }, [filteredGeneratedFiles, selectedGeneratedFileId, setSelectedGeneratedFileId]);

  const selectedGeneratedFile = useMemo(
    () => filteredGeneratedFiles.find((file) => file.id === selectedGeneratedFileId) || null,
    [filteredGeneratedFiles, selectedGeneratedFileId]
  );

  const selectedRecipe = useMemo(() => getPromptRecipe(selectedRecipeId), [selectedRecipeId]);
  const selectedVariant = useMemo(() => getVariantDirection(selectedVariantId), [selectedVariantId]);

  const variantPrompt = useMemo(
    () => buildVariantPrompt({
      basePrompt: compiled.productionPrompt,
      recipe: selectedRecipe,
      variant: selectedVariant,
    }),
    [compiled.productionPrompt, selectedRecipe, selectedVariant]
  );

  const batchEligibleEntries = useMemo(
    () => visibleContentFiles.filter((entry) => entry.type === selectedContentType),
    [visibleContentFiles, selectedContentType]
  );

  useEffect(() => {
    setSelectedBatchContentPaths((current) =>
      current.filter((path) => batchEligibleEntries.some((entry) => entry.path === path))
    );
  }, [batchEligibleEntries, setSelectedBatchContentPaths]);

  const batchPromptItems = useMemo<BatchPromptItem[]>(() => {
    if (!selectedBrand || !selectedProject || !selectedOutputProfile) return [];

    return batchEligibleEntries
      .filter((entry) => selectedBatchContentPaths.includes(entry.path))
      .map((entry) => {
        const result = compilePrompt({
          brandId: selectedBrand.id,
          brandLabel: selectedBrand.label,
          projectLabel: selectedProject.label,
          contentLabel: entry.label,
          contentType: entry.type,
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
          contentMarkdown: entry.path === selectedContentPath ? editableMarkdown : entry.raw,
          contentFilename: entry.filename,
          layoutPresetId: selectedLayoutPresetId,
          backgroundPresetId: selectedBackgroundPresetId,
          documentBackgroundPresetId: selectedDocumentBackgroundPresetId,
          backgroundTheme: selectedBackgroundTheme,
        });

        return {
          id: entry.path,
          label: entry.label,
          filename: entry.filename,
          prompt: buildBatchVisualPrompt({
            basePrompt: result.productionPrompt,
            recipe: selectedRecipe,
            variant: selectedVariant,
          }),
          outputFilename: getSuggestedOutputFilename({
            contentPath: entry.path,
            contentFilename: entry.filename,
            outputProfileId: selectedOutputProfile.id,
            outputType: selectedOutputProfile.outputType,
            category: entry.type,
          }),
        };
      });
  }, [
    selectedBrand,
    selectedProject,
    selectedOutputProfile,
    batchEligibleEntries,
    selectedBatchContentPaths,
    brandLogoAssets,
    logoSourceText,
    brandRules,
    headerRules,
    footerRules,
    editableProjectHeader,
    editableProjectFooter,
    editableProjectLogo,
    logoRules,
    typographyRules,
    documentRules,
    projectDocumentRules,
    tableRules,
    projectRules,
    visualRules,
    selectedContentPath,
    editableMarkdown,
    selectedLayoutPresetId,
    selectedBackgroundPresetId,
    selectedDocumentBackgroundPresetId,
    selectedBackgroundTheme,
    selectedRecipe,
    selectedVariant,
  ]);

  const brandQaScorecard = useMemo(
    () => buildBrandQaScorecard({
      logoAsset: compiled.promptPreview.logoAsset,
      headerText: compiled.promptPreview.headerText,
      footerText: compiled.promptPreview.footerText,
      visibleText: isDocumentLike ? compiled.promptPreview.bodyContent : compiled.promptPreview.visibleText,
      selectedFile: selectedGeneratedFile,
      outputFilename: customOutputFilename || suggestedOutputFilename,
      promptIssues: compiled.promptLint.issues,
    }),
    [compiled, customOutputFilename, suggestedOutputFilename, selectedGeneratedFile, isDocumentLike]
  );

  const masterFrameMetadata = {
    outputProfileId: selectedOutputProfile.id,
    headerText: compiled.promptPreview.headerText,
    footerText: compiled.promptPreview.footerText,
    logoAsset: compiled.promptPreview.logoAsset,
  };

  const styleMemoryPrompt = useMemo(
    () => buildStyleMemoryPrompt({
      files: generatedFiles,
      approvedIds: approvedGeneratedFileIds,
    }),
    [generatedFiles, approvedGeneratedFileIds]
  );

  const documentAssemblyPrompt = useMemo(() => {
    if (!selectedBrand || !selectedProject) return "";
    const documentEntries = allProjectContent
      .filter((entry) => entry.type === "documents" && entry.contentSet === selectedContentSet)
      .map((entry) => ({
        label: entry.label,
        filename: entry.filename,
        raw: entry.path === selectedContentPath ? editableMarkdown : entry.raw,
      }));

    return buildDocumentAssemblyPrompt({
      brandLabel: selectedBrand.label,
      projectLabel: selectedProject.label,
      documentTitle: `${selectedProject.label} Document Pack`,
      entries: documentEntries,
    });
  }, [selectedBrand, selectedProject, allProjectContent, selectedContentSet, selectedContentPath, editableMarkdown]);

  const [promptReviewEnabled, setPromptReviewEnabled] = useFeatureFlag("promptReview.enabled");
  const promptReviewResult = useMemo(() => {
    if (!promptReviewEnabled || !selectedBrand || !selectedProject || !selectedOutputProfile || !selectedContentPath) {
      return null;
    }
    if (!("prompt" in compiled) || !("resolvedBackgroundTheme" in compiled)) return null;

    return promptReviewService.review({
      brandId: selectedBrand.id,
      projectId: selectedProject.id,
      contentId: selectedContentPath,
      outputProfileId: selectedOutputProfile.id,
    }, compiled);
  }, [
    promptReviewEnabled,
    selectedBrand,
    selectedProject,
    selectedOutputProfile,
    selectedContentPath,
    compiled,
  ]);
  const promptReviewContextKey = [
    selectedBrand?.id,
    selectedProject?.id,
    selectedContentPath,
    selectedOutputProfile?.id,
  ].filter(Boolean).join("|");
  const {
    previousSnapshot: promptReviewPreviousSnapshot,
    comparison: promptReviewComparison,
    saveSnapshot: savePromptReviewSnapshot,
    clearSnapshots: clearPromptReviewSnapshots,
  } = usePromptReviewSnapshots(promptReviewContextKey, promptReviewResult);


  return { ...scope, distributionPrefill, setDistributionPrefill, refreshGeneratedFiles, refreshTargetFolder, versionOptions, filteredGeneratedFiles, exportableGeneratedImages, selectedExportFiles, selectedGeneratedFile, selectedRecipe, selectedVariant, variantPrompt, batchEligibleEntries, batchPromptItems, brandQaScorecard, masterFrameMetadata, styleMemoryPrompt, documentAssemblyPrompt, promptReviewEnabled, setPromptReviewEnabled, promptReviewResult, promptReviewPreviousSnapshot, promptReviewComparison, savePromptReviewSnapshot, clearPromptReviewSnapshots };
}
