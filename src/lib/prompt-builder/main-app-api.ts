import type {
  CreateProjectInput,
  ProjectScaffoldPreview,
  RuntimeContentFile,
  RuntimeProject,
} from "./project-scaffold";
import {
  browserWorkspaceAvailable,
  connectBrowserWorkspace,
  createBrowserProject,
  getBrowserWorkspaceStatus,
  listBrowserRuntimeProjects,
  loadBrowserRuntimeProject,
  previewBrowserProjectScaffold,
} from "./browser-workspace";

export type StorageStatus = {
  ok: boolean;
  localApiAvailable: boolean;
  contentRoot?: string;
  writable?: boolean;
  version?: string;
  error?: string;
  browserFsAvailable?: boolean;
  workspaceKind?: "server" | "browser";
};

const unavailableMessage = "Local storage is available when the app is running with npm run dev.";

export function mainAppAssetUrl(path: string): string {
  return path;
}

export function mainAppFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, init);
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await mainAppFetch(path, init);
  } catch {
    throw new Error(unavailableMessage);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(unavailableMessage);
  }

  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Main app request failed (${response.status}).`);
  return payload;
}

export function getStorageStatus(): Promise<StorageStatus> {
  return jsonRequest<StorageStatus>("/api/storage/status").catch(async () => {
    const browserStatus = await getBrowserWorkspaceStatus();
    if (browserStatus) return browserStatus;
    throw new Error(unavailableMessage);
  });
}

export function updateStorageRoot(contentRoot: string, initialize = false): Promise<StorageStatus> {
  return jsonRequest<StorageStatus>("/api/storage/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentRoot, initialize }),
  }).catch(async () => {
    if (!browserWorkspaceAvailable()) throw new Error(unavailableMessage);
    return connectBrowserWorkspace(initialize);
  });
}

export function previewProjectScaffold(input: CreateProjectInput): Promise<ProjectScaffoldPreview> {
  return jsonRequest<ProjectScaffoldPreview>("/api/projects/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => Promise.resolve(previewBrowserProjectScaffold(input)));
}

export function createProject(input: CreateProjectInput): Promise<{
  ok: boolean;
  project: RuntimeProject;
  files: RuntimeContentFile[];
  preview: ProjectScaffoldPreview;
}> {
  return jsonRequest<{
    ok: boolean;
    project: RuntimeProject;
    files: RuntimeContentFile[];
    preview: ProjectScaffoldPreview;
  }>("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(async () => {
    if (!browserWorkspaceAvailable()) throw new Error(unavailableMessage);
    return createBrowserProject(input);
  });
}

export function listRuntimeProjects(): Promise<{ ok: boolean; projects: RuntimeProject[] }> {
  return jsonRequest<{ ok: boolean; projects: RuntimeProject[] }>("/api/projects").catch(async () => {
    if (!browserWorkspaceAvailable()) throw new Error(unavailableMessage);
    return listBrowserRuntimeProjects();
  });
}

export function loadRuntimeProject(brandId: string, projectId: string): Promise<{
  ok: boolean;
  project: RuntimeProject;
  files: RuntimeContentFile[];
}> {
  return jsonRequest<{
    ok: boolean;
    project: RuntimeProject;
    files: RuntimeContentFile[];
  }>(`/api/projects/${encodeURIComponent(brandId)}/${encodeURIComponent(projectId)}`).catch(async () => {
    if (!browserWorkspaceAvailable()) throw new Error(unavailableMessage);
    return loadBrowserRuntimeProject(brandId, projectId);
  });
}
