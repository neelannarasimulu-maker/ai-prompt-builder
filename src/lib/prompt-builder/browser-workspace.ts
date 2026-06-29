import {
  buildProjectScaffold,
  selectedScaffoldFiles,
  type CreateProjectInput,
  type ProjectScaffoldPreview,
  type RuntimeContentFile,
  type RuntimeProject,
} from "./project-scaffold";
import type { StorageStatus } from "./main-app-api";
import { isIgnoredContentPath, parseContentSetPath } from "./content-set-paths";
import {
  getGeneratedFileDisplayName,
  getGeneratedFileVersionLabel,
  type GeneratedContentCategory,
  type GeneratedContentFile,
} from "./generated-content-contract";

const DB_NAME = "prompt-builder-browser-workspace";
const STORE_NAME = "handles";
const ROOT_HANDLE_KEY = "content-root";

type BrowserWorkspacePersisted = {
  kind: "browser";
  logicalRoot: string;
  displayRoot: string;
  writable: boolean;
};

type BrowserWorkspaceDirectoryHandle = FileSystemDirectoryHandle;
type BrowserPermissionMode = "read" | "readwrite";

function browserWorkspaceSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window && "indexedDB" in window;
}

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open workspace database."));
  });
}

async function readStoredHandle(): Promise<BrowserWorkspaceDirectoryHandle | null> {
  if (!browserWorkspaceSupported()) return null;
  const db = await openWorkspaceDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(ROOT_HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as BrowserWorkspaceDirectoryHandle | undefined) || null);
    request.onerror = () => reject(request.error || new Error("Could not read stored workspace handle."));
  });
}

async function writeStoredHandle(handle: BrowserWorkspaceDirectoryHandle): Promise<void> {
  const db = await openWorkspaceDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, ROOT_HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not store workspace handle."));
  });
}

async function clearStoredHandle(): Promise<void> {
  if (!browserWorkspaceSupported()) return;
  const db = await openWorkspaceDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(ROOT_HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not clear workspace handle."));
  });
}

async function queryWorkspacePermission(handle: BrowserWorkspaceDirectoryHandle, mode: BrowserPermissionMode): Promise<PermissionState> {
  try {
    return await (handle as unknown as {
      queryPermission?: (descriptor: { mode: BrowserPermissionMode }) => Promise<PermissionState>;
    }).queryPermission?.({ mode }) ?? "denied";
  } catch {
    return "denied";
  }
}

async function requestWorkspacePermission(handle: BrowserWorkspaceDirectoryHandle, mode: BrowserPermissionMode): Promise<PermissionState> {
  try {
    return await (handle as unknown as {
      requestPermission?: (descriptor: { mode: BrowserPermissionMode }) => Promise<PermissionState>;
    }).requestPermission?.({ mode }) ?? "denied";
  } catch {
    return "denied";
  }
}

async function ensureWorkspacePermission(handle: BrowserWorkspaceDirectoryHandle, mode: BrowserPermissionMode): Promise<boolean> {
  const current = await queryWorkspacePermission(handle, mode);
  if (current === "granted") return true;
  const requested = await requestWorkspacePermission(handle, mode);
  return requested === "granted";
}

function browserWorkspaceDisplayRoot(handle: BrowserWorkspaceDirectoryHandle): string {
  return `Browser connected: ${handle.name}`;
}

async function getConnectedRootHandle(requireWrite = false): Promise<BrowserWorkspaceDirectoryHandle> {
  const handle = await readStoredHandle();
  if (!handle) throw new Error("Choose a local content folder first.");

  const canRead = await ensureWorkspacePermission(handle, "read");
  if (!canRead) {
    await clearStoredHandle();
    throw new Error("Local content folder access was not granted.");
  }

  if (requireWrite) {
    const canWrite = await ensureWorkspacePermission(handle, "readwrite");
    if (!canWrite) throw new Error("Write access to the selected local content folder was not granted.");
  }

  return handle;
}

async function normalizeContentRoot(handle: BrowserWorkspaceDirectoryHandle, initialize = false): Promise<BrowserWorkspaceDirectoryHandle> {
  if (handle.name.toLowerCase() === "content") {
    if (initialize) await handle.getDirectoryHandle("projects", { create: true });
    return handle;
  }

  const contentHandle = await handle.getDirectoryHandle("content", { create: initialize });
  if (initialize) await contentHandle.getDirectoryHandle("projects", { create: true });
  return contentHandle;
}

async function directoryHandleAt(root: BrowserWorkspaceDirectoryHandle, segments: string[], create = false): Promise<BrowserWorkspaceDirectoryHandle> {
  let current = root;
  for (const segment of segments) {
    if (!segment) continue;
    current = await current.getDirectoryHandle(segment, { create });
  }
  return current;
}

async function fileHandleAt(root: BrowserWorkspaceDirectoryHandle, logicalPath: string, create = false): Promise<FileSystemFileHandle> {
  const normalized = logicalPath.replace(/\\/g, "/").replace(/^content\/?/, "").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  const filename = segments.pop();
  if (!filename) throw new Error("A file path is required.");
  const directory = await directoryHandleAt(root, segments, create);
  return directory.getFileHandle(filename, { create });
}

async function writeTextFile(root: BrowserWorkspaceDirectoryHandle, logicalPath: string, content: string): Promise<void> {
  const fileHandle = await fileHandleAt(root, logicalPath, true);
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function readTextFile(handle: FileSystemFileHandle): Promise<string> {
  return (await handle.getFile()).text();
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/i, "")
    .replace(/^\d+[-_ ]*/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function runtimeProjectFromBrowserFolder(brandId: string, projectId: string, projectMarkdown: string): RuntimeProject {
  const workflow = projectMarkdown.match(/^Workflow:\s*(presentation|document_pack|linkedin_campaign|mixed)\s*$/mi)?.[1] as RuntimeProject["workflow"];
  const label = projectMarkdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || projectId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
  return { id: projectId, label, brandId, folder: `content/projects/${brandId}/${projectId}`, workflow };
}

async function walkMarkdownFiles(
  directory: BrowserWorkspaceDirectoryHandle,
  pathPrefix: string
): Promise<Array<{ path: string; filename: string; raw: string }>> {
  const files: Array<{ path: string; filename: string; raw: string }> = [];
  for await (const [name, handle] of directory.entries()) {
    const nextPath = pathPrefix ? `${pathPrefix}/${name}` : name;
    if (handle.kind === "directory") {
      if (isIgnoredContentPath(nextPath)) continue;
      files.push(...await walkMarkdownFiles(handle, nextPath));
      continue;
    }
    if (!name.toLowerCase().endsWith(".md") || isIgnoredContentPath(nextPath)) continue;
    files.push({
      path: `content/${nextPath.replace(/\\/g, "/")}`,
      filename: name,
      raw: await readTextFile(handle),
    });
  }
  return files;
}

export async function getBrowserWorkspaceStatus(): Promise<StorageStatus | null> {
  if (!browserWorkspaceSupported()) return null;
  const handle = await readStoredHandle();
  if (!handle) {
    return {
      ok: true,
      localApiAvailable: false,
      contentRoot: "",
      writable: false,
      version: "browser-fs-1",
      browserFsAvailable: true,
      workspaceKind: "browser",
    };
  }

  const readable = await ensureWorkspacePermission(handle, "read");
  const writable = readable && await queryWorkspacePermission(handle, "readwrite") === "granted";
  if (!readable) {
    await clearStoredHandle();
    return {
      ok: true,
      localApiAvailable: false,
      contentRoot: "",
      writable: false,
      version: "browser-fs-1",
      browserFsAvailable: true,
      workspaceKind: "browser",
    };
  }

  return {
    ok: true,
    localApiAvailable: false,
    contentRoot: browserWorkspaceDisplayRoot(handle),
    writable,
    version: "browser-fs-1",
    browserFsAvailable: true,
    workspaceKind: "browser",
  };
}

export async function connectBrowserWorkspace(initialize = false): Promise<StorageStatus> {
  if (!browserWorkspaceSupported()) {
    throw new Error("This browser does not support selecting local folders for the hosted app.");
  }

  const picked = await (window as unknown as {
    showDirectoryPicker: (options?: { mode?: BrowserPermissionMode }) => Promise<BrowserWorkspaceDirectoryHandle>;
  }).showDirectoryPicker({ mode: "readwrite" });
  const contentRoot = await normalizeContentRoot(picked, initialize);
  const hasRead = await ensureWorkspacePermission(contentRoot, "read");
  const hasWrite = await ensureWorkspacePermission(contentRoot, "readwrite");
  if (!hasRead || !hasWrite) throw new Error("Access to the selected local content folder was not granted.");

  await contentRoot.getDirectoryHandle("projects", { create: true });
  await writeStoredHandle(contentRoot);

  return {
    ok: true,
    localApiAvailable: false,
    contentRoot: browserWorkspaceDisplayRoot(contentRoot),
    writable: true,
    version: "browser-fs-1",
    browserFsAvailable: true,
    workspaceKind: "browser",
  };
}

export async function listBrowserRuntimeProjects(): Promise<{ ok: boolean; projects: RuntimeProject[] }> {
  const root = await getConnectedRootHandle();
  const projectsRoot = await root.getDirectoryHandle("projects").catch(() => null);
  if (!projectsRoot) return { ok: true, projects: [] };

  const projects: RuntimeProject[] = [];
  for await (const [brandName, brandHandle] of projectsRoot.entries()) {
    if (brandHandle.kind !== "directory") continue;
    for await (const [projectName, projectHandle] of brandHandle.entries()) {
      if (projectHandle.kind !== "directory") continue;
      const projectFile = await projectHandle.getFileHandle("project.md").catch(() => null);
      const raw = projectFile ? await readTextFile(projectFile) : "";
      projects.push(runtimeProjectFromBrowserFolder(brandName, projectName, raw));
    }
  }

  return { ok: true, projects: projects.sort((a, b) => a.label.localeCompare(b.label)) };
}

export async function loadBrowserRuntimeProject(brandId: string, projectId: string): Promise<{
  ok: boolean;
  project: RuntimeProject;
  files: RuntimeContentFile[];
}> {
  const root = await getConnectedRootHandle();
  const projectDirectory = await directoryHandleAt(root, ["projects", brandId, projectId], false);
  const projectFile = await projectDirectory.getFileHandle("project.md").catch(() => null);
  const projectMarkdown = projectFile ? await readTextFile(projectFile) : "";
  const project = runtimeProjectFromBrowserFolder(brandId, projectId, projectMarkdown);
  const markdownFiles = await walkMarkdownFiles(projectDirectory, `projects/${brandId}/${projectId}`);
  const files = markdownFiles
    .map((entry): RuntimeContentFile | undefined => {
      const relative = entry.path.replace(/^content\/projects\/[^/]+\/[^/]+\//, "");
      const parsed = parseContentSetPath(relative);
      if (parsed?.isDescriptor) return undefined;
      return {
        path: entry.path,
        type: parsed?.type || "project",
        contentSet: parsed?.contentSet,
        filename: entry.filename,
        label: titleFromFilename(entry.filename),
        raw: entry.raw,
      };
    })
    .filter((entry): entry is RuntimeContentFile => Boolean(entry))
    .sort((a, b) => a.path.localeCompare(b.path));

  return { ok: true, project, files };
}

export async function saveBrowserContentSourceFile(path: string, content: string): Promise<{
  ok: boolean;
  path: string;
  savedAt: string;
}> {
  const root = await getConnectedRootHandle(true);
  await writeTextFile(root, path, content);
  return { ok: true, path, savedAt: new Date().toISOString() };
}

export async function createBrowserProject(input: CreateProjectInput): Promise<{
  ok: boolean;
  project: RuntimeProject;
  files: RuntimeContentFile[];
  preview: ProjectScaffoldPreview;
}> {
  const preview = buildProjectScaffold(input);
  if (preview.errors.length > 0) throw new Error(preview.errors.join(" "));

  const root = await getConnectedRootHandle(true);
  for (const file of selectedScaffoldFiles(input)) {
    await writeTextFile(root, `${preview.targetFolder}/${file.path}`, file.content);
  }
  for (const generatedFolder of preview.generatedFolders) {
    await directoryHandleAt(root, `${preview.targetFolder}/${generatedFolder}`.replace(/^content\/?/, "").split("/"), true);
  }

  return loadBrowserRuntimeProject(input.brandId, input.projectSlug).then((payload) => ({
    ok: true,
    project: payload.project,
    files: payload.files,
    preview,
  }));
}

export function previewBrowserProjectScaffold(input: CreateProjectInput): ProjectScaffoldPreview {
  return buildProjectScaffold(input);
}

export function browserWorkspaceAvailable(): boolean {
  return browserWorkspaceSupported();
}

function normalizeLogicalPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function fileTypeFromFilename(filename: string): GeneratedContentFile["fileType"] {
  const lower = filename.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(lower)) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "document";
  if (lower.endsWith(".pptx")) return "presentation";
  if (/\.(md|txt)$/i.test(lower)) return "text";
  return "other";
}

function generatedCategoryFromRelativePath(relativePath: string): GeneratedContentCategory {
  const normalized = normalizeLogicalPath(relativePath);
  if (normalized.includes("/visuals/")) return "visuals";
  if (normalized.includes("/linkedin/")) return "linkedin";
  if (normalized.includes("/documents/")) return "documents";
  return "documents";
}

async function browserFileObjectUrl(handle: FileSystemFileHandle): Promise<string> {
  return URL.createObjectURL(await handle.getFile());
}

async function walkGeneratedFiles(
  directory: BrowserWorkspaceDirectoryHandle,
  pathPrefix: string
): Promise<GeneratedContentFile[]> {
  const files: GeneratedContentFile[] = [];

  for await (const [name, handle] of directory.entries()) {
    const nextPath = pathPrefix ? `${pathPrefix}/${name}` : name;
    if (handle.kind === "directory") {
      files.push(...await walkGeneratedFiles(handle, nextPath));
      continue;
    }

    const file = await handle.getFile();
    const routePath = `content/${normalizeLogicalPath(nextPath)}`;
    const generatedRelativePath = normalizeLogicalPath(nextPath.replace(/^projects\/[^/]+\/[^/]+\//, ""));

    files.push({
      id: routePath,
      routePath,
      projectRelativePath: generatedRelativePath,
      filename: name,
      displayName: getGeneratedFileDisplayName(name),
      relativePath: routePath,
      generatedRelativePath,
      category: generatedCategoryFromRelativePath(routePath),
      contentSet: generatedRelativePath.split("/")[1] || "",
      versionLabel: getGeneratedFileVersionLabel(generatedRelativePath),
      fileUrl: await browserFileObjectUrl(handle),
      fileType: fileTypeFromFilename(name),
      sizeBytes: file.size,
      modifiedAt: new Date(file.lastModified).toISOString(),
    });
  }

  return files;
}

export async function listBrowserGeneratedContent(input: {
  projectFolder: string;
  category?: GeneratedContentCategory;
  contentSet?: string;
}): Promise<{
  generatedContentRoot: string;
  files: GeneratedContentFile[];
}> {
  const root = await getConnectedRootHandle();
  const projectRoot = await directoryHandleAt(root, normalizeLogicalPath(input.projectFolder).replace(/^content\/?/, "").split("/"), false);
  const categories = input.category && input.category !== "all"
    ? [input.category]
    : (["visuals", "documents", "linkedin"] as const);
  const files: GeneratedContentFile[] = [];

  for (const category of categories) {
    const categoryRoot = await projectRoot.getDirectoryHandle(category).catch(() => null);
    if (!categoryRoot) continue;

    if (input.contentSet) {
      const contentSetRoot = await categoryRoot.getDirectoryHandle(input.contentSet).catch(() => null);
      const generatedRoot = contentSetRoot
        ? await contentSetRoot.getDirectoryHandle("_generated").catch(() => null)
        : null;
      if (generatedRoot) {
        files.push(...await walkGeneratedFiles(generatedRoot, `${normalizeLogicalPath(input.projectFolder).replace(/^content\/?/, "")}/${category}/${input.contentSet}/_generated`));
      }
      continue;
    }

    for await (const [contentSetName, contentSetHandle] of categoryRoot.entries()) {
      if (contentSetHandle.kind !== "directory") continue;
      const generatedRoot = await contentSetHandle.getDirectoryHandle("_generated").catch(() => null);
      if (!generatedRoot) continue;
      files.push(...await walkGeneratedFiles(generatedRoot, `${normalizeLogicalPath(input.projectFolder).replace(/^content\/?/, "")}/${category}/${contentSetName}/_generated`));
    }
  }

  return {
    generatedContentRoot: `Browser connected: ${normalizeLogicalPath(input.projectFolder)}`,
    files,
  };
}

export async function getBrowserGeneratedContentFolder(input: {
  projectFolder: string;
  category: Exclude<GeneratedContentCategory, "all">;
  contentSet: string;
}): Promise<{
  folder: string;
  generatedContentRoot: string;
}> {
  const root = await getConnectedRootHandle();
  const relativeFolder = `${normalizeLogicalPath(input.projectFolder).replace(/^content\/?/, "")}/${input.category}/${input.contentSet}/_generated`;
  await directoryHandleAt(root, relativeFolder.split("/"), true);

  return {
    folder: `Browser connected: content/${relativeFolder}`,
    generatedContentRoot: `Browser connected: content/${relativeFolder}`,
  };
}
