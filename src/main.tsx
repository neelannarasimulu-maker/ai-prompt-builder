import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

import { brands, projects } from "./lib/prompt-builder/registry";
import { outputProfiles } from "./lib/prompt-builder/output-profiles";
import { backgroundPresets, getBackgroundPreset } from "./lib/prompt-builder/background-presets";
import { documentBackgroundPresets, getDocumentBackgroundPreset } from "./lib/prompt-builder/document-background-presets";
import { layoutPresets, getLayoutPreset } from "./lib/prompt-builder/layout-presets";
import { compilePrompt } from "./lib/prompt-builder/prompt-compiler";
import {
  applyDynamicContentTagsToMarkdown,
  generateDynamicContentTags,
} from "./lib/prompt-builder/dynamic-content-tags";
import { parseMarkdownSections } from "./lib/prompt-builder/content-sections";
import {
  getSuggestedOutputFilename,
  replaceExtension,
} from "./lib/prompt-builder/output-naming";
import {
  formatFileSize,
  generatedCategoryForProfile,
  generatedContentCategories,
  getProjectGeneratedContentFolder,
  listProjectGeneratedContent,
  saveContentSourceFile,
  uploadProjectGeneratedContent,
  type GeneratedContentCategory,
  type GeneratedContentFile,
} from "./lib/prompt-builder/project-generated-content-api";

type BrandItem = {
  id: string;
  label: string;
  folder: string;
  logoPath?: string;
  logoPreviewPath?: string;
  logoAsset?: string;
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
};

type ContentEntry = {
  path: string;
  type: string;
  filename: string;
  label: string;
  raw: string;
};

type Toast = {
  id: number;
  type: "success" | "warning" | "info";
  message: string;
};

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

function getProjectContentEntries(project: ProjectItem): ContentEntry[] {
  const prefix = `${project.folder}/`;

  return Object.entries(markdownMap)
    .filter(([path]) => path.startsWith(prefix))
    .filter(([path]) => !path.includes("/generated-content/"))
    .filter(([path]) => {
      const lower = path.toLowerCase();
      return (
        !lower.endsWith("/project.md") &&
        !lower.endsWith("/visual-rules.md")
      );
    })
    .map(([path, raw]) => {
      const relative = path.slice(prefix.length);
      const parts = relative.split("/");
      const type = parts.length > 1 ? parts[0] : "content";
      const filename = parts[parts.length - 1];

      return {
        path,
        type,
        filename,
        label: titleFromFileName(filename),
        raw,
      };
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
  return `${file.filename} · ${formatFileSize(file.sizeBytes)}`;
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
  const projectList = projects as ProjectItem[];
  const profileList = outputProfiles as OutputProfileItem[];

  const [toasts, setToasts] = useState<Toast[]>([]);

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

  const allProjectContent = useMemo(
    () => (selectedProject ? getProjectContentEntries(selectedProject) : []),
    [selectedProject]
  );

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

  const visibleContentFiles = useMemo(
    () => allProjectContent.filter((entry) => entry.type === selectedContentType),
    [allProjectContent, selectedContentType]
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
    "clean_white_form"
  );
  const [promptView, setPromptView] = useLocalStorageState<"production" | "debug" | "actions" | "contract">(
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
      setSelectedOutputProfileId(profileList[0]?.id ?? "landscape_image_16_9");
    }
  }, [profileList, selectedOutputProfileId, setSelectedOutputProfileId]);

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
  const projectRules = selectedProject ? getProjectFile(selectedProject, "project.md") : "";
  const projectVisualRules = selectedProject ? getProjectFile(selectedProject, "visual-rules.md") : "";
  const visualRules = [brandVisualRules, projectVisualRules].filter(Boolean).join("\n\n");
  const logoSourceText = getBrandLogoSource(selectedBrand);

  const compiled = useMemo(() => {
    if (!selectedBrand || !selectedProject || !selectedOutputProfile) {
      return {
        productionPrompt: "",
        debugPrompt: "",
        actionPrompt: "",
        contractPrompt: "",
        warnings: ["Please select a brand, project and output profile."],
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
        brandLabel: selectedBrand.label,
        projectLabel: selectedProject.label,
        contentLabel: selectedContentEntry?.label ?? "Untitled Content",
        contentType: selectedContentType || "content",
        outputProfile: selectedOutputProfile,
        logoAsset:
          selectedBrand.logoAsset ||
          `content/brands/${selectedBrand.id}/assets/${selectedBrand.id}-logo.svg`,
        logoSourceText,
        brandRules,
        headerRules,
        footerRules,
        logoRules,
        typographyRules,
        documentRules,
        tableRules,
        projectRules,
        visualRules,
        contentMarkdown: editableMarkdown,
        contentFilename: selectedContentEntry?.filename,
        layoutPresetId: selectedLayoutPresetId,
        backgroundPresetId: selectedBackgroundPresetId,
        documentBackgroundPresetId: selectedDocumentBackgroundPresetId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown prompt compiler error";
      return {
        productionPrompt: "",
        debugPrompt: `Prompt compiler failed:\n${message}`,
        actionPrompt: "Fix the content/source error shown in Debug, then refresh.",
        contractPrompt: "",
        warnings: [`Prompt compiler error: ${message}`],
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
    logoRules,
    typographyRules,
    documentRules,
    tableRules,
    projectRules,
    visualRules,
    logoSourceText,
    editableMarkdown,
    selectedLayoutPresetId,
    selectedBackgroundPresetId,
    selectedDocumentBackgroundPresetId,
  ]);

  const shownPrompt =
    promptView === "production"
      ? compiled.productionPrompt
      : promptView === "debug"
        ? compiled.debugPrompt
        : promptView === "actions"
          ? compiled.actionPrompt
          : compiled.contractPrompt;

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

  async function handleCopyPromptAndOpenChatGPT() {
    await copyToClipboard(compiled.productionPrompt, "Production prompt");
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }

  async function handleSaveContentSource() {
    if (!selectedContentEntry) return;

    try {
      const response = await saveContentSourceFile(selectedContentEntry.path, editableMarkdown);

      if (!response.ok) {
        showToast(response.error || "Could not save content source.", "warning");
        return;
      }

      selectedContentEntry.raw = editableMarkdown;
      setSavedMarkdownByPath((current) => ({
        ...current,
        [selectedContentEntry.path]: editableMarkdown,
      }));

      showToast(`Saved ${selectedContentEntry.filename}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save content source.", "warning");
    }
  }

  function handleApplyDynamicTags() {
    if (!selectedBrand || !selectedProject || !selectedOutputProfile || !selectedContentEntry) return;

    const sections = parseMarkdownSections(editableMarkdown);
    const update = generateDynamicContentTags({
      brandLabel: selectedBrand.label,
      projectLabel: selectedProject.label,
      contentLabel: selectedContentEntry.label,
      contentType: selectedContentType,
      outputType: selectedOutputProfile.outputType,
      sections,
      selectedLayoutPresetId,
      selectedBackgroundPresetId,
    });

    const updated = applyDynamicContentTagsToMarkdown(editableMarkdown, update);
    setEditableMarkdown(updated);
    showToast(`Dynamic tags updated: ${update.summary.slice(0, 3).join(" · ")}`, "info");
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
    await copyToClipboard(editableMarkdown, label);
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
  const [targetFolder, setTargetFolder] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

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
      });
      setGeneratedFiles(result.files);
      if (showSuccess) showToast(`Found ${result.files.length} file(s).`, "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not list generated content.", "warning");
    }
  }

  async function refreshTargetFolder() {
    if (!selectedProject || uploadCategory === "all") return;

    try {
      const result = await getProjectGeneratedContentFolder({
        projectFolder: selectedProject.folder,
        category: uploadCategory,
      });
      setTargetFolder(result.folder);
    } catch {
      setTargetFolder("");
    }
  }

  useEffect(() => {
    refreshGeneratedFiles();
  }, [selectedProjectId, selectedGeneratedCategory]);

  useEffect(() => {
    refreshTargetFolder();
  }, [selectedProjectId, uploadCategory]);

  const filteredGeneratedFiles = useMemo(() => {
    const query = generatedSearch.trim().toLowerCase();

    return generatedFiles.filter((file) => {
      const matchesCategory =
        selectedGeneratedCategory === "all" || file.category === selectedGeneratedCategory;

      if (!matchesCategory) return false;
      if (!query) return true;

      return [
        file.filename,
        file.relativePath,
        file.generatedRelativePath,
        file.fileType,
        file.category,
      ].join(" ").toLowerCase().includes(query);
    });
  }, [generatedFiles, generatedSearch, selectedGeneratedCategory]);

  useEffect(() => {
    if (selectedGeneratedFileId && filteredGeneratedFiles.some((file) => file.id === selectedGeneratedFileId)) return;
    setSelectedGeneratedFileId(filteredGeneratedFiles[0]?.id ?? "");
  }, [filteredGeneratedFiles, selectedGeneratedFileId, setSelectedGeneratedFileId]);

  const selectedGeneratedFile = useMemo(
    () => filteredGeneratedFiles.find((file) => file.id === selectedGeneratedFileId) || null,
    [filteredGeneratedFiles, selectedGeneratedFileId]
  );

  async function handleUploadGeneratedFile() {
    if (!selectedProject || !uploadFile) {
      showToast("Choose a file and project before uploading.", "warning");
      return;
    }

    try {
      const response = await uploadProjectGeneratedContent({
        projectFolder: selectedProject.folder,
        category: uploadCategory,
        file: uploadFile,
        targetFilename: customOutputFilename || suggestedOutputFilename,
      });

      if (!response.ok) {
        showToast(response.error || "Upload failed.", "warning");
        return;
      }

      setUploadFile(null);
      setSelectedGeneratedCategory(uploadCategory);
      await refreshGeneratedFiles();
      showToast(`Uploaded as ${response.filename}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not upload file.", "warning");
    }
  }

  const logoPreviewPath =
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

      <header className="hero-bar">
        <div>
          <p className="eyebrow">AI Visual Studio</p>
          <h1>Dynamic Layout Control Desk</h1>
          <p>
            Selections persist after refresh. Copy the filename, copy one
            run-ready prompt and open ChatGPT. Document prompts include the
            current MD source inline while visual prompts stay image-safe.
          </p>
        </div>
        <div className="hero-metrics">
          <div><span>{compiled.promptStats.words}</span><small>prompt words</small></div>
          <div><span>{compiled.promptStats.visibleTextLines}</span><small>visible lines</small></div>
          <div><span>{filteredGeneratedFiles.length}</span><small>filtered files</small></div>
        </div>
      </header>

      <main className="workspace-grid">
        <aside className="panel sidebar-panel">
          <div className="panel-title">
            <h2>Selection</h2>
            <p>Brand, project, source and output controls.</p>
          </div>

          <div className="form-stack">
            <label className="field"><span>Brand</span>
              <select value={selectedBrandId} onChange={(e) => setSelectedBrandId(e.target.value)}>
                {brandList.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}
              </select>
            </label>

            <label className="field"><span>Project</span>
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                {filteredProjects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
              </select>
            </label>

            <label className="field"><span>Content Type</span>
              <select value={selectedContentType} onChange={(e) => setSelectedContentType(e.target.value)}>
                {contentTypes.map((type) => <option key={type} value={type}>{contentTypeLabel(type)}</option>)}
              </select>
            </label>

            <label className="field"><span>Content File</span>
              <select value={selectedContentPath} onChange={(e) => setSelectedContentPath(e.target.value)}>
                {visibleContentFiles.map((entry) => <option key={entry.path} value={entry.path}>{entry.label}</option>)}
              </select>
            </label>

            <label className="field"><span>Output Profile</span>
              <select value={selectedOutputProfileId} onChange={(e) => setSelectedOutputProfileId(e.target.value)}>
                {profileList.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
              </select>
            </label>

            <label className="field"><span>Layout Style</span>
              <select value={selectedLayoutPresetId} onChange={(e) => setSelectedLayoutPresetId(e.target.value)}>
                {layoutPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>

            {!isDocumentLike && (
              <label className="field"><span>Slide / Image Background</span>
                <select value={selectedBackgroundPresetId} onChange={(e) => setSelectedBackgroundPresetId(e.target.value)}>
                  {backgroundPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select>
              </label>
            )}

            {isDocumentLike && (
              <label className="field"><span>Document Background</span>
                <select value={selectedDocumentBackgroundPresetId} onChange={(e) => setSelectedDocumentBackgroundPresetId(e.target.value)}>
                  {documentBackgroundPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="logo-preview-card">
            <div className="small-label">Brand logo</div>
            <div className="logo-stage">
              <img src={logoPreviewPath} alt={`${selectedBrand?.label ?? "Brand"} logo`} />
            </div>
            <code>{selectedBrand?.logoPreviewPath}</code>
          </div>

          <div className="status-card">
            <h3>Dynamic Analysis</h3>
            {compiled.dynamicLayoutPlan ? (
              <>
                <p className="status-ok">{compiled.dynamicLayoutPlan.contentKind} · {compiled.dynamicLayoutPlan.density?.level ?? "unknown"}</p>
                <p>Layout: <strong>{compiled.dynamicLayoutPlan.layoutPresetId}</strong></p>
                <p>Background: <strong>{compiled.dynamicLayoutPlan.backgroundPresetId}</strong></p>
              </>
            ) : <p>No analysis available.</p>}
            {compiled.warnings.length > 0 && (
              <ul>{compiled.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            )}
          </div>
        </aside>

        <section className="panel editor-panel">
          <div className="panel-title panel-title-row">
            <div>
              <h2>Content Source</h2>
              <p>Visible Text stays human-controlled. Other tags can be regenerated dynamically.</p>
            </div>
            <div className="button-row">
              {isContentDirty && <span className="dirty-pill">Unsaved</span>}
              <button className="secondary-button" type="button" onClick={handleApplyDynamicTags}>Update dynamic tags</button>
              <button className="secondary-button" type="button" onClick={() => setEditableMarkdown(selectedContentEntry?.raw ?? "")}>Reset</button>
              <button className="primary-button" type="button" onClick={handleSaveContentSource}>Save source</button>
            </div>
          </div>

          <textarea className="content-editor" value={editableMarkdown} onChange={(e) => setEditableMarkdown(e.target.value)} spellCheck={false} />
        </section>

        <section className="panel prompt-panel">
          <div className="panel-title panel-title-row">
            <div>
              <h2>Compiled Prompt</h2>
              <p>Copy one run-ready, output-specific prompt. Production prompts stay lean: visual prompts use Visible Text once only, while document prompts use Body Content and the source MD.</p>
            </div>
            <div className="segmented-toggle">
              <button type="button" className={promptView === "production" ? "active" : ""} onClick={() => setPromptView("production")}>Production</button>
              <button type="button" className={promptView === "contract" ? "active" : ""} onClick={() => setPromptView("contract")}>Contract</button>
              <button type="button" className={promptView === "debug" ? "active" : ""} onClick={() => setPromptView("debug")}>Debug</button>
              <button type="button" className={promptView === "actions" ? "active" : ""} onClick={() => setPromptView("actions")}>Actions</button>
            </div>
          </div>

          <div className="output-name-card">
            <label className="field">
              <span>Suggested output filename</span>
              <input value={customOutputFilename} onChange={(e) => setCustomOutputFilename(e.target.value)} />
            </label>
            <div className="button-row compact-actions">
              <button className="secondary-button" type="button" onClick={() => copyToClipboard(customOutputFilename || suggestedOutputFilename, "Output filename")}>Copy filename</button>
            </div>
          </div>

          <div className="action-strip streamlined-actions">
            <button className="primary-button" type="button" onClick={() => copyToClipboard(compiled.productionPrompt, "Prompt")}>Copy prompt</button>
            <button className="secondary-button" type="button" onClick={handleCopyPromptAndOpenChatGPT}>Copy prompt + open ChatGPT</button>
          </div>

          {(isDocumentLike || selectedOutputProfile.outputType === "image") && (
            <div className="doc-workflow-card simplified-doc-workflow">
              <div>
                <strong>{isDocumentLike ? "Document MD controls" : "Visual MD controls"}</strong>
                <p>{isDocumentLike
                  ? "Use Download document MD when you want to attach the source separately. The copied prompt is still run-ready and uses Body Content for the document."
                  : "Copy the visual MD when you want the source content separately. The compiled prompt stays visual-only and does not duplicate semantic analysis into the production prompt."}</p>
              </div>

              <div className="doc-workflow-actions compact-actions">
                {isDocumentLike && (
                  <button className="primary-button" type="button" onClick={handleDownloadDocumentMarkdownFile}>Download document MD</button>
                )}
                <button className={isDocumentLike ? "secondary-button" : "primary-button"} type="button" onClick={handleCopySourceMarkdownFile}>
                  {isDocumentLike ? "Copy document MD" : "Copy visual MD"}
                </button>
              </div>
            </div>
          )}

          <textarea className="prompt-output" value={shownPrompt} readOnly spellCheck={false} />
        </section>

        <section className="panel generated-panel">
          <div className="panel-title panel-title-row">
            <div>
              <h2>Project Generated Content</h2>
              <p>Upload files with the suggested filename, no manual rename dance required.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => refreshGeneratedFiles(true)}>Refresh files</button>
          </div>

          <div className="generated-folder-banner">
            <div>
              <span>Upload target folder</span>
              <strong>{targetFolder || "Select a generated content type"}</strong>
            </div>
            <p><code>{selectedProject?.folder}/generated-content/{uploadCategory}/</code></p>
          </div>

          <div className="upload-bar">
            <label className="field"><span>Upload type</span>
              <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as Exclude<GeneratedContentCategory, "all">)}>
                {generatedContentCategories.filter((category) => category.id !== "all").map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </label>

            <label className="field"><span>Save uploaded file as</span>
              <input value={customOutputFilename} onChange={(e) => setCustomOutputFilename(e.target.value)} />
            </label>

            <label className="field file-field"><span>Choose generated file</span>
              <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </label>

            <button className="primary-button upload-button" type="button" onClick={handleUploadGeneratedFile}>Upload + rename</button>
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

              {filteredGeneratedFiles.length === 0 ? (
                <div className="empty-state">
                  <h3>No files match the selected filters.</h3>
                  <p>Current filter: {categoryLabel(selectedGeneratedCategory)}</p>
                </div>
              ) : (
                <div className="generated-file-list">
                  {filteredGeneratedFiles.map((file) => (
                    <button key={file.id} type="button" className={selectedGeneratedFile?.id === file.id ? "generated-file-card active" : "generated-file-card"} onClick={() => setSelectedGeneratedFileId(file.id)}>
                      <strong>{file.filename}</strong>
                      <span>{file.generatedRelativePath}</span>
                      <small>{categoryLabel(file.category)} · {file.fileType} · {formatFileSize(file.sizeBytes)}</small>
                    </button>
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
      </main>
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
