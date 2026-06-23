import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import {
  DistributionPanel,
  type DistributionPrefill,
} from "./features/distribution/distribution-panel";

import { brands, projects, type BrandAssetItem } from "./lib/prompt-builder/registry";
import { outputProfiles } from "./lib/prompt-builder/output-profiles";
import { backgroundPresets, getBackgroundPreset } from "./lib/prompt-builder/background-presets";
import { documentBackgroundPresets, getDocumentBackgroundPreset } from "./lib/prompt-builder/document-background-presets";
import { backgroundThemes, type BackgroundTheme } from "./lib/prompt-builder/background-themes";
import { layoutPresets, getLayoutPreset } from "./lib/prompt-builder/layout-presets";
import { compilePrompt } from "./lib/prompt-builder/prompt-compiler";
import { parseMarkdownSections } from "./lib/prompt-builder/content-sections";
import { isIgnoredContentPath, parseContentSetPath } from "./lib/prompt-builder/content-set-paths";
import {
  getDeliveryPackFilenameBase,
  getSuggestedOutputFilename,
  replaceExtension,
} from "./lib/prompt-builder/output-naming";
import {
  getDefaultAssistVersionLabel,
  importLatestChatGptDownload,
  normalizeAssistImageFilename,
  normalizeAssistVersionLabel,
  validateAssistImportInput,
  type ChatGptAssistImportResponse,
} from "./lib/prompt-builder/chatgpt-assist";
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
  saveContentSourceFile,
  uploadProjectGeneratedContent,
  type GeneratedContentCategory,
  type GeneratedContentFile,
} from "./lib/prompt-builder/project-generated-content-api";
import { extractLogoAssetPaths } from "./lib/prompt-builder/logo-resolution";
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
  type WorkflowMode,
} from "./lib/prompt-builder/workflow-features";
import {
  buildProjectScaffold,
  createProject,
  getStorageStatus,
  listRuntimeProjects,
  loadRuntimeProject,
  slugifyProjectName,
  updateStorageRoot,
  type CreateProjectInput,
  type ProjectWorkflow,
  type RuntimeContentFile,
  type RuntimeProject,
} from "./lib/prompt-builder";

type BrandItem = {
  id: string;
  label: string;
  folder: string;
  logoPath?: string;
  logoPreviewPath?: string;
  logoAsset?: string;
  logoAssets: BrandAssetItem[];
};

type ProjectItem = {
  id: string;
  label: string;
  brandId: string;
  folder: string;
};

type OutputProfileItem = {
  id: string;
  label: string;
  outputType: "image" | "document" | "pdf" | "text" | "email";
  format?: string;
  useCase?: string;
  instruction?: string;
  typography?: string;
};

type ContentEntry = {
  path: string;
  type: string;
  contentSet: string;
  filename: string;
  label: string;
  raw: string;
};

type Toast = {
  id: number;
  type: "success" | "warning" | "info";
  message: string;
};

type PromptView = "production" | "debug" | "actions" | "contract";

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

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-crash-screen">
          <h1>Prompt Builder could not render</h1>
          <p>The app caught a runtime error instead of showing a blank page.</p>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const rawMarkdownModules = import.meta.glob("../content/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const rawLogoModules = import.meta.glob("../content/brands/**/assets/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function normalizePath(path: string): string {
  return path.replace(/^..\//, "").replace(/\\/g, "/");
}

const markdownMap: Record<string, string> = Object.fromEntries(
  Object.entries(rawMarkdownModules).map(([path, raw]) => [
    normalizePath(path),
    raw,
  ])
);

const logoSourceMap: Record<string, string> = Object.fromEntries(
  Object.entries(rawLogoModules).map(([path, raw]) => [
    normalizePath(path),
    raw,
  ])
);

const generatedFileCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function titleFromFileName(filename: string): string {
  return filename
    .replace(/\.md$/i, "")
    .replace(/^\d+[-_ ]*/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getMarkdownContent(path: string): string {
  return markdownMap[path] ?? "";
}

function getBrandFile(brand: BrandItem, fileName: string): string {
  return getMarkdownContent(`${brand.folder}/${fileName}`);
}

function getProjectFile(project: ProjectItem, fileName: string): string {
  return getMarkdownContent(`${project.folder}/${fileName}`);
}

function getBrandLogoSource(brand: BrandItem | null): string {
  if (!brand) return "";

  const candidates = [
    brand.logoAsset,
    brand.logoPath,
    `${brand.folder}/assets/${brand.id}-logo.svg`,
    `${brand.folder}/assets/${brand.id}.svg`,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const normalized = normalizePath(candidate);
    if (logoSourceMap[normalized]) return logoSourceMap[normalized];
  }

  return "";
}

function firstLogoAssetPath(markdown: string): string {
  return extractLogoAssetPaths(markdown)[0] || "";
}

function logoNotesFromMarkdown(markdown: string): string {
  const firstPath = firstLogoAssetPath(markdown);
  return markdown
    .replace(/^#\s+Project Logo\s*$/im, "")
    .replace(/^Logo asset:\s*.*$/im, "")
    .replace(/`?content\/(?:brands|projects)\/[^\s`'"<>)]+\.(?:png|svg|jpg|jpeg|webp)`?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || (firstPath ? "" : markdown.trim());
}

function buildProjectLogoMarkdown(assetPath: string, notes: string): string {
  return [
    "# Project Logo",
    "",
    assetPath ? `Logo asset: ${assetPath}` : "",
    "",
    notes.trim(),
  ].filter((line, index, lines) => line || (index > 0 && index < lines.length - 1)).join("\n").trim() + "\n";
}

function getProjectContentEntries(project: ProjectItem): ContentEntry[] {
  const prefix = `${project.folder}/`;

  return Object.entries(markdownMap)
    .filter(([path]) => path.startsWith(prefix))
    .filter(([path]) => !isIgnoredContentPath(path))
    .filter(([path]) => {
      const lower = path.toLowerCase();
      return (
        !lower.endsWith("/project.md") &&
        !lower.endsWith("/visual-rules.md") &&
        !lower.endsWith("/header.md") &&
        !lower.endsWith("/footer.md") &&
        !lower.endsWith("/logo.md")
      );
    })
    .flatMap(([path, raw]): ContentEntry[] => {
      const parsed = parseContentSetPath(path);
      if (!parsed || parsed.isDescriptor) return [];
      const { type, contentSet, filename } = parsed;

      return [{
        path,
        type,
        contentSet,
        filename,
        label: titleFromFileName(filename),
        raw,
      }];
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.filename.localeCompare(b.filename);
    });
}

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

function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

function App() {
  const brandList = brands as BrandItem[];
  const profileList = outputProfiles as OutputProfileItem[];

  const [runtimeProjects, setRuntimeProjects] = useState<RuntimeProject[]>([]);
  const [runtimeFilesByProject, setRuntimeFilesByProject] = useState<Record<string, RuntimeContentFile[]>>({});
  const projectList = useMemo(() => {
    const merged = new Map<string, ProjectItem>();
    for (const project of projects as ProjectItem[]) merged.set(`${project.brandId}/${project.id}`, project);
    for (const project of runtimeProjects) merged.set(`${project.brandId}/${project.id}`, project);
    return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [runtimeProjects]);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [storageRoot, setStorageRoot] = useState("");
  const [storageState, setStorageState] = useState<"checking" | "available" | "read-only">("checking");
  const localWritesAvailable = storageState === "available";
  const [isProjectWizardOpen, setIsProjectWizardOpen] = useState(false);
  const [projectWizardStep, setProjectWizardStep] = useState(1);
  const [projectDraft, setProjectDraft] = useState<CreateProjectInput>(() => newProjectDraft(brandList[0]));
  const [projectCreateError, setProjectCreateError] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  function showToast(message: string, type: Toast["type"] = "success") {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3400);
  }

  const [selectedBrandId, setSelectedBrandId] = useLocalStorageState(
    "promptBuilder.selectedBrandId",
    brandList[0]?.id ?? ""
  );

  const filteredProjects = useMemo(
    () => projectList.filter((project) => project.brandId === selectedBrandId),
    [projectList, selectedBrandId]
  );

  const [selectedProjectId, setSelectedProjectId] = useLocalStorageState(
    "promptBuilder.selectedProjectId",
    filteredProjects[0]?.id ?? ""
  );

  useEffect(() => {
    if (!filteredProjects.find((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(filteredProjects[0]?.id ?? "");
    }
  }, [filteredProjects, selectedProjectId, setSelectedProjectId]);

  const selectedBrand = useMemo(
    () => brandList.find((brand) => brand.id === selectedBrandId) ?? null,
    [brandList, selectedBrandId]
  );

  const selectedProject = useMemo(
    () => filteredProjects.find((project) => project.id === selectedProjectId) ?? null,
    [filteredProjects, selectedProjectId]
  );

  async function refreshRuntimeRepository() {
    try {
      const status = await getStorageStatus();
      setStorageState(status.writable ? "available" : "read-only");
      setStorageRoot(status.contentRoot || "");
      const payload = await listRuntimeProjects();
      setRuntimeProjects(payload.projects || []);
    } catch {
      setStorageState("read-only");
    }
  }

  useEffect(() => {
    void refreshRuntimeRepository();
  }, []);

  useEffect(() => {
    if (!selectedProject || storageState !== "available") return;
    void loadRuntimeProject(selectedProject.brandId, selectedProject.id)
      .then((payload) => {
        setRuntimeFilesByProject((current) => ({
          ...current,
          [`${payload.project.brandId}/${payload.project.id}`]: payload.files,
        }));
      })
      .catch(() => undefined);
  }, [selectedProjectId, selectedProject?.brandId, storageState]);

  const activeRuntimeFiles = selectedProject ? runtimeFilesByProject[`${selectedProject.brandId}/${selectedProject.id}`] || [] : [];
  const allProjectContent = useMemo(() => {
    if (!selectedProject) return [];
    const merged = new Map<string, ContentEntry>();
    for (const entry of getProjectContentEntries(selectedProject)) merged.set(entry.path, entry);
    for (const entry of activeRuntimeFiles) {
      if (entry.type !== "project" && entry.contentSet) merged.set(entry.path, entry as ContentEntry);
    }
    return Array.from(merged.values()).sort((a, b) => a.type.localeCompare(b.type) || a.filename.localeCompare(b.filename));
  }, [selectedProject, activeRuntimeFiles]);

  const contentTypes = useMemo(
    () => Array.from(new Set(allProjectContent.map((entry) => entry.type))),
    [allProjectContent]
  );

  const [selectedContentType, setSelectedContentType] = useLocalStorageState(
    "promptBuilder.selectedContentType",
    ""
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

  const [selectedContentSet, setSelectedContentSet] = useLocalStorageState(
    "promptBuilder.selectedContentSet",
    ""
  );

  useEffect(() => {
    if (!contentSets.includes(selectedContentSet)) setSelectedContentSet(contentSets[0] ?? "");
  }, [contentSets, selectedContentSet, setSelectedContentSet]);

  const visibleContentFiles = useMemo(
    () => allProjectContent.filter((entry) => entry.type === selectedContentType && entry.contentSet === selectedContentSet),
    [allProjectContent, selectedContentType, selectedContentSet]
  );

  const [selectedContentPath, setSelectedContentPath] = useLocalStorageState(
    "promptBuilder.selectedContentPath",
    ""
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

  const [editableMarkdown, setEditableMarkdown] = useState("");
  const [savedMarkdownByPath, setSavedMarkdownByPath] = useState<Record<string, string>>({});

  useEffect(() => {
    const savedVersion = selectedContentEntry ? savedMarkdownByPath[selectedContentEntry.path] : undefined;
    setEditableMarkdown(savedVersion ?? selectedContentEntry?.raw ?? "");
  }, [selectedContentEntry, savedMarkdownByPath]);

  const [selectedOutputProfileId, setSelectedOutputProfileId] = useLocalStorageState(
    "promptBuilder.selectedOutputProfileId",
    "landscape_image_16_9"
  );
  const [selectedLayoutPresetId, setSelectedLayoutPresetId] = useLocalStorageState(
    "promptBuilder.selectedLayoutPresetId",
    "auto"
  );
  const [selectedBackgroundPresetId, setSelectedBackgroundPresetId] = useLocalStorageState(
    "promptBuilder.selectedBackgroundPresetId",
    "auto"
  );
  const [selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId] = useLocalStorageState(
    "promptBuilder.selectedDocumentBackgroundPresetId",
    "auto_brand_document"
  );
  const [selectedBackgroundTheme, setSelectedBackgroundTheme] = useLocalStorageState<BackgroundTheme>(
    "promptBuilder.selectedBackgroundTheme",
    "balanced"
  );
  const [promptView, setPromptView] = useLocalStorageState<PromptView>(
    "promptBuilder.promptView",
    "production"
  );
  const [selectedDocumentChunkIndex, setSelectedDocumentChunkIndex] = useLocalStorageState(
    "promptBuilder.selectedDocumentChunkIndex",
    0
  );

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

  const [customOutputFilename, setCustomOutputFilename] = useLocalStorageState(
    "promptBuilder.customOutputFilename",
    ""
  );

  useEffect(() => {
    setCustomOutputFilename(suggestedOutputFilename);
  }, [suggestedOutputFilename, setCustomOutputFilename]);

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

  async function handleSaveContentSource() {
    if (!selectedContentEntry) return;
    const sourceToSave = selectedContentType === "linkedin"
      ? editableMarkdown.replace(/^## Body Content\s*$/gim, "## LinkedIn Post Text")
      : editableMarkdown;

    try {
      const response = await saveContentSourceFile(selectedContentEntry.path, sourceToSave);

      if (!response.ok) {
        showToast(response.error || "Could not save content source.", "warning");
        return;
      }

      selectedContentEntry.raw = sourceToSave;
      setEditableMarkdown(sourceToSave);
      setSavedMarkdownByPath((current) => ({
        ...current,
        [selectedContentEntry.path]: sourceToSave,
      }));

      showToast(`Saved ${selectedContentEntry.filename}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save content source.", "warning");
    }
  }

  async function handleSaveProjectChrome(kind: "header" | "footer" | "logo") {
    const path = kind === "header" ? projectHeaderPath : kind === "footer" ? projectFooterPath : projectLogoPath;
    const content = kind === "header" ? editableProjectHeader : kind === "footer" ? editableProjectFooter : editableProjectLogo;
    if (!path) return;

    try {
      const response = await saveContentSourceFile(path, content);

      if (!response.ok) {
        showToast(response.error || `Could not save project ${kind}.`, "warning");
        return;
      }

      setSavedMarkdownByPath((current) => ({
        ...current,
        [path]: content,
      }));

      showToast(`Saved project ${kind}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Could not save project ${kind}.`, "warning");
    }
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

  const isContentDirty = selectedContentEntry ? editableMarkdown !== selectedContentEntry.raw : false;
  const isDocumentLike = selectedOutputProfile?.outputType === "document" || selectedOutputProfile?.outputType === "pdf";
  const isImageOutput = selectedOutputProfile?.outputType === "image";

  const inferredGeneratedCategory = useMemo(
    () =>
      generatedCategoryForProfile({
        outputType: selectedOutputProfile.outputType,
        profileId: selectedOutputProfile.id,
        contentType: selectedContentType,
      }),
    [selectedOutputProfile, selectedContentType]
  );

  const [selectedGeneratedCategory, setSelectedGeneratedCategory] =
    useLocalStorageState<GeneratedContentCategory>("promptBuilder.selectedGeneratedCategory", inferredGeneratedCategory);
  const [uploadCategory, setUploadCategory] =
    useLocalStorageState<Exclude<GeneratedContentCategory, "all">>("promptBuilder.uploadCategory", inferredGeneratedCategory);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedContentFile[]>([]);
  const [selectedGeneratedFileId, setSelectedGeneratedFileId] = useLocalStorageState(
    "promptBuilder.selectedGeneratedFileId",
    ""
  );
  const [generatedSearch, setGeneratedSearch] = useLocalStorageState(
    "promptBuilder.generatedSearch",
    ""
  );
  const [selectedGeneratedVersion, setSelectedGeneratedVersion] = useLocalStorageState(
    "promptBuilder.selectedGeneratedVersion",
    ""
  );
  const [selectedGeneratedFileIds, setSelectedGeneratedFileIds] = useLocalStorageState<string[]>(
    "promptBuilder.selectedGeneratedFileIds",
    []
  );
  const [isExportingGeneratedContent, setIsExportingGeneratedContent] = useState(false);
  const [isRenderingDocument, setIsRenderingDocument] = useState(false);

  useEffect(() => {
    if (!generatedContentCategories.some((category) => category.id === selectedGeneratedCategory)) {
      setSelectedGeneratedCategory(inferredGeneratedCategory);
    }
    if (!generatedContentCategories.some((category) => category.id === uploadCategory)) {
      setUploadCategory(inferredGeneratedCategory);
    }
  }, [selectedGeneratedCategory, uploadCategory, inferredGeneratedCategory, setSelectedGeneratedCategory, setUploadCategory]);
  const [targetFolder, setTargetFolder] = useState("");
  const [isAssistModalOpen, setIsAssistModalOpen] = useState(false);
  const [assistTargetVersion, setAssistTargetVersion] = useLocalStorageState(
    "promptBuilder.assistTargetVersion",
    ""
  );
  const [assistRunStartedAt, setAssistRunStartedAt] = useState("");
  const [assistSavedFile, setAssistSavedFile] = useState<ChatGptAssistImportResponse | null>(null);
  const [assistError, setAssistError] = useState("");
  const [isImportingAssistDownload, setIsImportingAssistDownload] = useState(false);
  const [assistCopiedPrompt, setAssistCopiedPrompt] = useState(false);
  const [assistCopiedFilename, setAssistCopiedFilename] = useState(false);
  const [assistChatGptOpened, setAssistChatGptOpened] = useState(false);
  const [assistUploadFile, setAssistUploadFile] = useState<File | null>(null);
  const [workflowMode, setWorkflowMode] = useLocalStorageState<WorkflowMode>(
    "promptBuilder.workflowMode",
    "run"
  );
  const [distributionPrefill, setDistributionPrefill] = useState<DistributionPrefill | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useLocalStorageState(
    "promptBuilder.selectedRecipeId",
    "investor_deck"
  );
  const [selectedVariantId, setSelectedVariantId] = useLocalStorageState(
    "promptBuilder.selectedVariantId",
    "executive_minimal"
  );
  const [selectedBatchContentPaths, setSelectedBatchContentPaths] = useLocalStorageState<string[]>(
    "promptBuilder.selectedBatchContentPaths",
    []
  );
  const [approvedGeneratedFileIds, setApprovedGeneratedFileIds] = useLocalStorageState<string[]>(
    "promptBuilder.approvedGeneratedFileIds",
    []
  );

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
        file.relativePath,
        file.generatedRelativePath,
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

  return (
    <div className="app-shell">
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {isProjectWizardOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="project-wizard-title">
          <div className="automation-modal project-wizard-modal">
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
                    {projectScaffoldPreview.requiredFiles.map((file) => <div className="scaffold-file required" key={file.path}><span aria-hidden="true">✓</span><code>{file.path}</code><small>Required</small></div>)}
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
          </div>
        </div>
      )}

      {isAssistModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="assist-modal-title">
          <div className="automation-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Normal Chrome assisted mode</p>
                <h2 id="assist-modal-title">Run ChatGPT Assistant</h2>
                <p>Use your logged-in ChatGPT tab. This assistant prepares the prompt and filename, then imports the downloaded image into the selected content set's version folder.</p>
              </div>
              <button className="quiet-button" type="button" onClick={() => setIsAssistModalOpen(false)}>Close</button>
            </div>

            <div className="automation-summary-grid">
              <div>
                <span>Brand / Project</span>
                <strong>{selectedBrand?.label || "None"} / {selectedProject?.label || "None"}</strong>
              </div>
              <div>
                <span>Current visual</span>
                <strong>{selectedContentEntry?.label || "None"}</strong>
              </div>
              <div>
                <span>Output filename</span>
                <strong>{normalizeAssistImageFilename(customOutputFilename || suggestedOutputFilename)}</strong>
              </div>
              <label className="field">
                <span>Target version folder</span>
                <select value={assistTargetVersion} onChange={(event) => setAssistTargetVersion(normalizeAssistVersionLabel(event.target.value))}>
                  {Array.from(new Set([assistTargetVersion || "v001", "v001", ...versionOptions.filter((version) => version !== "Unversioned")])).map((version) => (
                    <option key={version} value={version}>{version}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="automation-logo-row">
              <div className="logo-stage">
                <img src={logoPreviewPath} alt="Resolved automation logo" />
              </div>
              <div>
                <span>App-rendered master-frame logo</span>
                <code>{compiled.promptPreview.logoAsset || selectedProjectLogoAsset || selectedBrand?.logoAsset || "No logo asset"}</code>
              </div>
            </div>

            <div className="automation-preflight">
              {validateAssistImportInput({
                projectFolder: selectedProject?.folder,
                outputFilename: customOutputFilename || suggestedOutputFilename,
                versionLabel: assistTargetVersion,
                runStartedAt: assistRunStartedAt,
                masterFrame: masterFrameMetadata,
              }).length === 0 ? (
                <p className="status-ok">Ready. Downloaded images after {assistRunStartedAt ? new Date(assistRunStartedAt).toLocaleTimeString() : "this run starts"} can be imported from Downloads.</p>
              ) : (
                <ul>
                  {validateAssistImportInput({
                    projectFolder: selectedProject?.folder,
                    outputFilename: customOutputFilename || suggestedOutputFilename,
                    versionLabel: assistTargetVersion,
                    runStartedAt: assistRunStartedAt,
                    masterFrame: masterFrameMetadata,
                  }).map((error) => <li key={error}>{error}</li>)}
                </ul>
              )}
            </div>

            <div className="automation-steps">
              <div className={`automation-step step-${assistCopiedPrompt ? "complete" : "queued"}`}>
                <span>{assistCopiedPrompt ? "complete" : "queued"}</span>
                <strong>Copy prompt</strong>
                <p>Paste this prompt into your logged-in ChatGPT tab.</p>
              </div>
              <div className={`automation-step step-${assistCopiedFilename ? "complete" : "queued"}`}>
                <span>{assistCopiedFilename ? "complete" : "queued"}</span>
                <strong>Copy filename</strong>
                <p>Copied filename excludes the extension, matching the app filename rule.</p>
              </div>
              <div className={`automation-step step-${assistChatGptOpened ? "complete" : "queued"}`}>
                <span>{assistChatGptOpened ? "complete" : "queued"}</span>
                <strong>Open ChatGPT</strong>
                <p>Generate and download body artwork only. Do not attach the logo; the app adds it in the locked frame.</p>
              </div>
              <div className={`automation-step step-${assistSavedFile?.ok ? "complete" : isImportingAssistDownload ? "running" : "queued"}`}>
                <span>{assistSavedFile?.ok ? "complete" : isImportingAssistDownload ? "running" : "queued"}</span>
                <strong>Import downloaded image</strong>
                <p>The app fits the newest downloaded artwork into the fixed body area, then renders the header, footer and real logo.</p>
              </div>
            </div>

            {assistError && <div className="automation-error">{assistError}</div>}

            {assistSavedFile?.ok && (
              <div className="automation-saved">
                <div>
                  <span>Saved file</span>
                  <strong>{assistSavedFile.filename}</strong>
                  <code>{assistSavedFile.relativePath}</code>
                </div>
                {assistSavedFile.fileUrl && <a className="secondary-button" href={assistSavedFile.fileUrl} target="_blank" rel="noreferrer">Open saved file</a>}
              </div>
            )}

            <div className="modal-actions">
              <button className="primary-button" type="button" onClick={handleAssistCopyPrompt}>Copy prompt</button>
              <button className="secondary-button" type="button" onClick={handleAssistCopyFilename}>Copy filename</button>
              <a className="secondary-button" href={logoPreviewPath} target="_blank" rel="noreferrer">Open logo file</a>
              <button className="secondary-button" type="button" onClick={handleOpenChatGptAssist}>Open ChatGPT</button>
              <button className="primary-button" type="button" onClick={handleImportLatestChatGptDownload} disabled={!localWritesAvailable || isImportingAssistDownload}>
                {isImportingAssistDownload ? "Importing..." : "Import latest download"}
              </button>
              <button className="secondary-button" type="button" onClick={() => refreshGeneratedFiles(true)}>Refresh generated content</button>
            </div>

            <div className="automation-upload-fallback">
              <label className="field">
                <span>Manual upload fallback</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setAssistUploadFile(event.target.files?.[0] || null)}
                />
              </label>
              <button className="secondary-button" type="button" onClick={handleAssistManualUpload} disabled={!localWritesAvailable || !assistUploadFile}>
                Save to generated folder
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="workflow-grid">
            <div className="workflow-card primary-workflow-card">
              <span>One-click ChatGPT run lane</span>
              <strong>{selectedContentEntry?.label || "No content selected"}</strong>
              <p>{isImageOutput ? "Prompt, filename, ChatGPT tab, logo reminder, latest-download import and preview refresh in one guided flow." : "Copy the run-ready prompt and open ChatGPT for document, PDF, text or email generation."}</p>
              <div className="button-row">
                <button className="primary-button" type="button" onClick={isImageOutput ? openAssistModal : handleCopyPromptAndOpenChatGPT}>{isImageOutput ? "Start run lane" : "Copy + open ChatGPT"}</button>
                <button className="secondary-button" type="button" onClick={handleCopyPromptAndOpenChatGPT}>Copy + open</button>
              </div>
            </div>

            <div className="workflow-card">
              <span>Run target</span>
              <strong>{normalizeAssistVersionLabel(assistTargetVersion || selectedGeneratedVersion || "v001")}</strong>
              <p>{normalizeAssistImageFilename(customOutputFilename || suggestedOutputFilename)}</p>
              <button className="secondary-button" type="button" onClick={handleCopyOutputFilename}>Copy filename</button>
            </div>

            <div className="workflow-card wide-card batch-card">
              <span>Batch Generate Deck / Pack</span>
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
          </div>
        )}

        {workflowMode === "review" && (
          <div className="workflow-grid">
            <div className="workflow-card">
              <span>Brand QA Scorecard</span>
              <strong>{brandQaScorecard.score}/100</strong>
              <p>{brandQaScorecard.blockingCount} blocking issue(s), {brandQaScorecard.advisoryCount} advisory issue(s).</p>
              <div className="qa-list">
                {brandQaScorecard.items.map((item) => (
                  <div key={item.id} className={`qa-item qa-${item.status}`}>
                    <strong>{item.label}</strong>
                    <small>{item.status}</small>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="workflow-card">
              <span>Project Style Memory</span>
              <strong>{approvedGeneratedFileIds.length} approved example(s)</strong>
              <p>Approved examples become future style references for composition, finish and pacing.</p>
              <button className="primary-button" type="button" onClick={handleCopyStyleMemory}>Copy style memory</button>
            </div>

            <div className="workflow-card wide-card comparison-card">
              <span>Output Comparison</span>
              <strong>{selectedGeneratedFile ? selectedGeneratedFile.displayName || selectedGeneratedFile.filename : "No file selected"}</strong>
              <p>Compare the selected generated output against the active source, suggested filename and brand QA score before exporting.</p>
              {selectedGeneratedFile && (
                <button
                  className={approvedGeneratedFileIds.includes(selectedGeneratedFile.id) ? "primary-button" : "secondary-button"}
                  type="button"
                  onClick={() => toggleApprovedGeneratedFile(selectedGeneratedFile.id)}
                >
                  {approvedGeneratedFileIds.includes(selectedGeneratedFile.id) ? "Approved example" : "Approve as example"}
                </button>
              )}
            </div>
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
              <p>Local writes go to the machine running this app. Point the content root at OneDrive or another hard drive folder. A hosted deployment remains read-only because a browser cannot write directly to your personal disk.</p>
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

      {workflowMode !== "distribution" && (
      <main className={`workspace-grid workspace-grid-${workflowMode}`}>
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
                {visibleContentFiles.map((entry) => <option key={entry.path} value={entry.path}>{entry.label}</option>)}
              </select>
            </label>

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
              {storageState === "read-only" && <p className="storage-notice">Local write tools are unavailable in this hosted build. Run <code>npm run dev</code> on your computer to create projects, save files, upload assets and export documents.</p>}
              <label className="field"><span>Content root</span><input value={storageRoot} onChange={(event) => setStorageRoot(event.target.value)} disabled={storageState !== "available"} placeholder="C:\\Users\\name\\OneDrive\\Prompt Builder\\content" /></label>
              <div className="button-row">
                <button className="secondary-button compact-button" type="button" disabled={storageState !== "available"} onClick={() => handleUpdateStorageRoot(false)}>Use root</button>
                <button className="quiet-button compact-button" type="button" disabled={storageState !== "available"} onClick={() => handleUpdateStorageRoot(true)}>Initialize root</button>
              </div>
              <p className="field-note">The main app writes to this folder. Initialization copies missing brand seed files without overwriting existing content.</p>
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

        {workflowMode === "create" && (
        <section className="panel editor-panel">
          <div className="project-chrome-editor">
            <div className="panel-title panel-title-row compact-panel-title">
              <div>
                <h2>Project Chrome</h2>
                <p>Header, footer and logo rules used before content-level overrides.</p>
              </div>
            </div>
            <div className="project-chrome-grid">
              <div className="chrome-card">
                <div className="chrome-card-header">
                  <span>Header markdown</span>
                  <div className="mini-actions">
                    <button className="quiet-button" type="button" onClick={() => setEditableProjectHeader(projectHeaderSource)}>Reset</button>
                    <button className="secondary-button compact-button" type="button" disabled={!localWritesAvailable} onClick={() => handleSaveProjectChrome("header")}>Save</button>
                  </div>
                </div>
                <textarea value={editableProjectHeader} onChange={(event) => setEditableProjectHeader(event.target.value)} spellCheck={false} />
              </div>

              <div className="chrome-card">
                <div className="chrome-card-header">
                  <span>Footer markdown</span>
                  <div className="mini-actions">
                    <button className="quiet-button" type="button" onClick={() => setEditableProjectFooter(projectFooterSource)}>Reset</button>
                    <button className="secondary-button compact-button" type="button" disabled={!localWritesAvailable} onClick={() => handleSaveProjectChrome("footer")}>Save</button>
                  </div>
                </div>
                <textarea value={editableProjectFooter} onChange={(event) => setEditableProjectFooter(event.target.value)} spellCheck={false} />
              </div>

              <div className="chrome-card project-logo-picker">
                <div className="chrome-card-header">
                  <span>Logo asset</span>
                  <div className="mini-actions">
                    <button className="quiet-button" type="button" onClick={() => {
                      const source = projectLogoSource;
                      setSelectedProjectLogoAsset(firstLogoAssetPath(source) || brandLogoAssets[0]?.path || "");
                      setEditableProjectLogoNotes(logoNotesFromMarkdown(source));
                    }}>Reset</button>
                    <button className="secondary-button compact-button" type="button" disabled={!localWritesAvailable} onClick={() => handleSaveProjectChrome("logo")}>Save</button>
                  </div>
                </div>
                <select value={selectedProjectLogoAsset} onChange={(event) => setSelectedProjectLogoAsset(event.target.value)}>
                  {brandLogoAssets.map((asset) => (
                    <option key={asset.path} value={asset.path}>
                      {asset.filename} ({asset.extension.toUpperCase()})
                    </option>
                  ))}
                </select>
                <div className="logo-choice-preview">
                  <img
                    src={brandLogoAssets.find((asset) => asset.path === selectedProjectLogoAsset)?.previewPath || logoPreviewPath}
                    alt="Selected project logo"
                  />
                  <code>{selectedProjectLogoAsset || "No logo asset selected"}</code>
                </div>
                <textarea
                  value={editableProjectLogoNotes}
                  onChange={(event) => setEditableProjectLogoNotes(event.target.value)}
                  spellCheck={false}
                  placeholder="Optional logo usage notes for this project."
                />
              </div>
            </div>
          </div>

          <div className="panel-title panel-title-row">
            <div>
              <h2>Content Source</h2>
              <p>Review and edit the markdown source used to generate this content.</p>
            </div>
            <div className="button-row">
              {isContentDirty && <span className="dirty-pill">Unsaved</span>}
              <button className="secondary-button" type="button" onClick={() => setEditableMarkdown(selectedContentEntry?.raw ?? "")}>Reset</button>
              <button className="primary-button" type="button" disabled={!localWritesAvailable} onClick={handleSaveContentSource}>Save source</button>
            </div>
          </div>

          <textarea className="content-editor" value={editableMarkdown} onChange={(e) => setEditableMarkdown(e.target.value)} spellCheck={false} />
        </section>
        )}

        {(workflowMode === "create" || workflowMode === "run") && (
        <section className="panel prompt-panel">
          <div className="panel-title panel-title-row">
            <div>
              <h2>{workflowMode === "create" ? "Prompt Preview" : "Run Prompt"}</h2>
              <p>{isDocumentLike ? "Render the production Word/PDF in the app for locked headers, footers and logo placement. Copy prompt remains available for direct ChatGPT fallback." : "Generate body artwork only; the app applies the locked master frame after download. Copy prompt remains available for direct ChatGPT use."}</p>
            </div>
            <div className="segmented-toggle">
              <button type="button" className={promptView === "production" ? "active" : ""} onClick={() => setPromptView("production")}>{outputPromptModeLabel(selectedOutputProfile?.outputType)}</button>
              <button type="button" className={promptView === "contract" ? "active" : ""} onClick={() => setPromptView("contract")}>Contract</button>
              <button type="button" className={promptView === "debug" ? "active" : ""} onClick={() => setPromptView("debug")}>Debug</button>
              <button type="button" className={promptView === "actions" ? "active" : ""} onClick={() => setPromptView("actions")}>Actions</button>
            </div>
          </div>

          <div className="output-name-card">
            <div className="output-name-main">
              <label className="field">
                <span>Suggested output filename</span>
                <input value={customOutputFilename} onChange={(e) => setCustomOutputFilename(e.target.value)} />
              </label>
              <p className="field-note">Copy uses basename only: {basenameWithoutExtension(customOutputFilename || suggestedOutputFilename)}</p>
            </div>
          </div>

          <div className="action-strip streamlined-actions">
            <button className="primary-button" type="button" onClick={() => copyToClipboard(compiled.productionPrompt, "Prompt")}>Copy prompt</button>
            {workflowMode === "run" && (
              <button className="secondary-button" type="button" disabled={!localWritesAvailable || !resolvedLogoAssetPath} onClick={handleCopyLogoFile}>Copy logo</button>
            )}
            {workflowMode === "run" && (
              <button className="secondary-button" type="button" disabled={!localWritesAvailable || !selectedContentEntry} onClick={handleCopySourceMarkdownFile}>
                {isDocumentLike ? "Copy document MD" : "Copy visual MD"}
              </button>
            )}
            {workflowMode === "run" && isDocumentLike && (
              <button className="secondary-button" type="button" disabled={!localWritesAvailable || isRenderingDocument} onClick={handleRenderLockedDocument}>
                {isRenderingDocument ? "Rendering…" : `Render locked ${selectedOutputProfile.outputType === "pdf" ? "PDF" : "Word document"}`}
              </button>
            )}
            {selectedContentType === "linkedin" && compiled.promptPreview.linkedinPostText?.trim() && (
              <button className="secondary-button" type="button" onClick={handleCopyLinkedInPostText}>Copy LinkedIn Post Text</button>
            )}
          </div>

          {isDocumentLike && (
            <div className="doc-workflow-card simplified-doc-workflow">
              <div>
                <strong>Document MD download</strong>
                <p>Download the source file when you need a saved fallback instead of copying it directly from the Run actions.</p>
              </div>

              <div className="doc-workflow-actions compact-actions">
                <button className="primary-button" type="button" onClick={handleDownloadDocumentMarkdownFile}>Download document MD</button>
              </div>
            </div>
          )}

          <div className="source-truth-preview">
            <div>
              <span>Detected sections</span>
              <pre>{compiled.promptPreview.detectedSections?.length ? compiled.promptPreview.detectedSections.join("\n") : "None"}</pre>
            </div>
            <div>
              <span>Ignored legacy sections</span>
              <pre>{compiled.promptPreview.ignoredLegacySections?.length ? compiled.promptPreview.ignoredLegacySections.join("\n") : "None"}</pre>
            </div>
            <div>
              <span>Resolved header</span>
              <pre>{compiled.promptPreview.headerText || "None"}</pre>
            </div>
            <div>
              <span>Resolved footer</span>
              <pre>{compiled.promptPreview.footerText || "None"}</pre>
            </div>
            <div>
              <span>Resolved logo</span>
              <pre>{compiled.promptPreview.logoAsset || "None"}</pre>
            </div>
            <div>
              <span>Background theme</span>
              <pre>{compiled.promptPreview.backgroundTheme || "None"}</pre>
            </div>
            <div>
              <span>Visible output text</span>
              <pre>{compiled.promptPreview.visibleText || "None"}</pre>
            </div>
            {selectedContentType === "linkedin" && (
              <div>
                <span>LinkedIn Post Text</span>
                <pre>{compiled.promptPreview.linkedinPostText || "None"}</pre>
              </div>
            )}
            {isDocumentLike && (
              <div>
                <span>Cover page source</span>
                <pre>{compiled.promptPreview.coverPageContent || "None"}</pre>
              </div>
            )}
            {isDocumentLike && (
              <div>
                <span>Table of contents</span>
                <pre>{compiled.promptPreview.tableOfContentsContent || "None"}</pre>
              </div>
            )}
            <div>
              <span>{isDocumentLike ? "Document body source" : "Guidance only"}</span>
              <pre>{(isDocumentLike ? compiled.promptPreview.bodyContent : compiled.promptPreview.guidance) || "None"}</pre>
            </div>
          </div>

          <textarea className="prompt-output" value={shownPrompt} readOnly spellCheck={false} />
        </section>
        )}

        {(workflowMode === "review" || workflowMode === "export") && (
        <section className="panel generated-panel">
          <div className="panel-title panel-title-row">
            <div>
              <h2>{workflowMode === "review" ? "Generated Content Review" : "Export Selection"}</h2>
              <p>{workflowMode === "review" ? "Inspect and approve generated files for this project." : "Select generated files for the delivery pack."}</p>
            </div>
            <button className="primary-button" type="button" onClick={() => refreshGeneratedFiles(true)}>Refresh files</button>
          </div>

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
                        <code>{file.generatedRelativePath}</code>
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
                  {selectedGeneratedFile && <p>{selectedGeneratedFile.relativePath}</p>}
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
        </section>
        )}
      </main>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
