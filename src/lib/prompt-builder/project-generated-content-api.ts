import { mainAppAssetUrl, mainAppFetch } from "./main-app-api";
import { saveBrowserContentSourceFile } from "./browser-workspace";
import {
  generatedContentRoutes,
  getGeneratedFileDisplayName as getGeneratedFileDisplayNameFromFilename,
  getGeneratedFileVersionLabel,
  normalizeGeneratedContentFile,
  type GeneratedContentCategory,
  type GeneratedContentFile,
} from "./generated-content-contract";

export {
  generatedContentRoutes,
  getGeneratedFileVersionLabel,
} from "./generated-content-contract";
export type {
  GeneratedContentCategory,
  GeneratedContentFile,
} from "./generated-content-contract";

export type SaveContentResponse = {
  ok: boolean;
  path?: string;
  savedAt?: string;
  error?: string;
};

export type CopyContentFileResponse = {
  ok: boolean;
  path?: string;
  filename?: string;
  error?: string;
};

export type ListGeneratedContentResponse = {
  ok: boolean;
  projectFolder?: string;
  generatedContentRoot?: string;
  files?: GeneratedContentFile[];
  error?: string;
};

export type UploadGeneratedContentResponse = {
  ok: boolean;
  filename?: string;
  relativePath?: string;
  routePath?: string;
  fileUrl?: string;
  savedAt?: string;
  error?: string;
};

export type GeneratedContentFolderResponse = {
  ok: boolean;
  folder?: string;
  generatedContentRoot?: string;
  error?: string;
};

export type ExportGeneratedContentResponse = {
  ok: boolean;
  filename?: string;
  relativePath?: string;
  routePath?: string;
  fileUrl?: string;
  skipped?: string[];
  error?: string;
};

export type MasterFrameMetadata = {
  outputProfileId: string;
  headerText: string;
  footerText: string;
  logoAsset: string;
};

export const generatedContentCategories: Array<{
  id: GeneratedContentCategory;
  label: string;
  folder: string;
}> = [
  { id: "all", label: "All generated content", folder: "" },
  { id: "visuals", label: "Visuals", folder: "visuals" },
  { id: "documents", label: "Documents", folder: "documents" },
  { id: "linkedin", label: "LinkedIn", folder: "linkedin" },
];

export async function saveContentSourceFile(
  path: string,
  content: string
): Promise<SaveContentResponse> {
  try {
    const response = await mainAppFetch("/api/content/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, content }),
    });

    return await response.json() as SaveContentResponse;
  } catch {
    return saveBrowserContentSourceFile(path, content);
  }
}

export async function copyContentFileToClipboard(path: string): Promise<CopyContentFileResponse> {
  const response = await mainAppFetch("/api/clipboard/file", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });

  return response.json() as Promise<CopyContentFileResponse>;
}

export async function listProjectGeneratedContent(input: {
  projectFolder: string;
  category?: GeneratedContentCategory;
  contentSet?: string;
}): Promise<{
  generatedContentRoot: string;
  files: GeneratedContentFile[];
}> {
  const params = new URLSearchParams({
    projectFolder: input.projectFolder,
    category: input.category || "all",
    ...(input.contentSet ? { contentSet: input.contentSet } : {}),
  });

  const response = await mainAppFetch(`${generatedContentRoutes.list}?${params.toString()}`);
  const payload = (await response.json()) as ListGeneratedContentResponse;

  if (!payload.ok) {
    throw new Error(payload.error || "Could not list generated content.");
  }

  return {
    generatedContentRoot: payload.generatedContentRoot || "",
    files: (payload.files || []).map((file) =>
      normalizeGeneratedContentFile({
        ...file,
        fileUrl: file.fileUrl ? mainAppAssetUrl(file.fileUrl) : file.fileUrl,
      })
    ),
  };
}

export async function uploadProjectGeneratedContent(input: {
  projectFolder: string;
  category: Exclude<GeneratedContentCategory, "all">;
  file: File;
  targetFilename?: string;
  versionLabel?: string;
  contentSet: string;
  masterFrame?: MasterFrameMetadata;
}): Promise<UploadGeneratedContentResponse> {
  const arrayBuffer = await input.file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const dataBase64 = btoa(binary);

  const response = await mainAppFetch(generatedContentRoutes.upload, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectFolder: input.projectFolder,
      category: input.category,
      filename: input.file.name,
      targetFilename: input.targetFilename,
      versionLabel: input.versionLabel,
      contentSet: input.contentSet,
      masterFrame: input.masterFrame,
      dataBase64,
    }),
  });

  const payload = await response.json() as UploadGeneratedContentResponse;
  return {
    ...payload,
    routePath: payload.routePath || payload.relativePath,
    fileUrl: payload.fileUrl ? mainAppAssetUrl(payload.fileUrl) : payload.fileUrl,
  };
}

export async function renderProjectDocument(input: {
  projectFolder: string;
  outputProfileId: "a4_document_portrait" | "a4_pdf_portrait";
  outputFilename: string;
  title: string;
  markdown: string;
  headerText: string;
  footerText: string;
  logoAsset: string;
  contentSet: string;
}): Promise<UploadGeneratedContentResponse> {
  const response = await mainAppFetch(generatedContentRoutes.renderDocument, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json() as UploadGeneratedContentResponse;
  return {
    ...payload,
    routePath: payload.routePath || payload.relativePath,
    fileUrl: payload.fileUrl ? mainAppAssetUrl(payload.fileUrl) : payload.fileUrl,
  };
}

export async function getProjectGeneratedContentFolder(input: {
  projectFolder: string;
  category: Exclude<GeneratedContentCategory, "all">;
  contentSet: string;
}): Promise<{
  folder: string;
  generatedContentRoot: string;
}> {
  const params = new URLSearchParams({
    projectFolder: input.projectFolder,
    category: input.category,
    contentSet: input.contentSet,
  });

  const response = await mainAppFetch(`${generatedContentRoutes.folder}?${params.toString()}`);
  const payload = (await response.json()) as GeneratedContentFolderResponse;

  if (!payload.ok || !payload.folder) {
    throw new Error(payload.error || "Could not resolve the content-set output folder.");
  }

  return {
    folder: payload.folder,
    generatedContentRoot: payload.generatedContentRoot || "",
  };
}

export async function exportProjectGeneratedContent(input: {
  projectFolder: string;
  fileIds: string[];
  format: "pptx" | "pdf";
  outputFilename?: string;
  category: Exclude<GeneratedContentCategory, "all">;
  contentSet: string;
  versionLabel?: string;
}): Promise<ExportGeneratedContentResponse> {
  const response = await mainAppFetch(generatedContentRoutes.export, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json() as ExportGeneratedContentResponse;
  return {
    ...payload,
    routePath: payload.routePath || payload.relativePath,
    fileUrl: payload.fileUrl ? mainAppAssetUrl(payload.fileUrl) : payload.fileUrl,
  };
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function generatedCategoryForProfile(input: {
  outputType: "image" | "document" | "pdf" | "text" | "email";
  profileId: string;
  contentType?: string;
}): Exclude<GeneratedContentCategory, "all"> {
  if (input.profileId.includes("linkedin") || input.contentType === "linkedin") return "linkedin";
  if (input.outputType === "image") return "visuals";
  if (input.outputType === "pdf" || input.outputType === "document") return "documents";
  if (
    input.contentType === "linkedin"
  ) {
    return "linkedin";
  }
  return "documents";
}

export function stripDuplicateExtensions(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 3) return filename;

  while (
    parts.length > 2 &&
    parts[parts.length - 1].toLowerCase() === parts[parts.length - 2].toLowerCase()
  ) {
    parts.pop();
  }

  return parts.join(".");
}

export function basenameWithoutExtension(filename: string): string {
  return stripDuplicateExtensions(filename).replace(/\.[a-z0-9]+$/i, "");
}

export function copyableFilename(filename: string): string {
  return basenameWithoutExtension(filename);
}

export function getGeneratedFileDisplayName(file: Pick<GeneratedContentFile, "filename">): string {
  return getGeneratedFileDisplayNameFromFilename(file.filename);
}

export function getGeneratedVersionSortValue(versionLabel: string): number {
  if (versionLabel === "Unversioned") return -1;
  const match = versionLabel.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function enrichGeneratedContentFile(file: GeneratedContentFile): GeneratedContentFile {
  return normalizeGeneratedContentFile(file);
}
