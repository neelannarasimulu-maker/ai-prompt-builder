export const generatedContentRoutes = {
  folder: "/api/generated-content/folder",
  list: "/api/generated-content/list",
  export: "/api/generated-content/export",
  renderDocument: "/api/generated-content/render-document",
  upload: "/api/generated-content/upload",
  assets: "/project-generated-content",
} as const;

export type GeneratedContentCategory =
  | "all"
  | "visuals"
  | "documents"
  | "linkedin";

export type GeneratedContentFile = {
  id: string;
  routePath?: string;
  projectRelativePath?: string;
  filename: string;
  displayName: string;
  relativePath: string;
  generatedRelativePath: string;
  category: GeneratedContentCategory;
  contentSet: string;
  versionLabel?: string;
  fileUrl: string;
  fileType: "image" | "pdf" | "document" | "presentation" | "text" | "other";
  sizeBytes: number;
  modifiedAt: string;
};

function normalizePath(value?: string): string {
  return (value || "").replace(/\\/g, "/").trim();
}

export function getGeneratedContentAssetUrl(routePath: string): string {
  return `${generatedContentRoutes.assets}/${normalizePath(routePath).replace(/^\/+/, "")}`;
}

export function getGeneratedFileDisplayName(filename: string): string {
  return filename
    .replace(/(\.[a-z0-9]+)+$/i, (match) => {
      const parts = match.split(".").filter(Boolean);
      while (parts.length > 1 && parts[parts.length - 1].toLowerCase() === parts[parts.length - 2].toLowerCase()) {
        parts.pop();
      }
      return parts.length ? `.${parts.join(".")}` : "";
    })
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getGeneratedFileVersionLabel(projectRelativePath: string): string | undefined {
  const segments = normalizePath(projectRelativePath).split("/");
  return segments.find((segment) => {
    const normalized = segment.trim();
    return /^v\d{3,}$/i.test(normalized) || /^version\s+\d+(?:\.\d+)?$/i.test(normalized);
  })?.trim();
}

export function normalizeGeneratedContentFile(file: GeneratedContentFile): GeneratedContentFile {
  const routePath = normalizePath(file.routePath || file.relativePath || file.id);
  const projectRelativePath = normalizePath(file.projectRelativePath || file.generatedRelativePath);
  const filename = file.filename.trim();

  return {
    ...file,
    id: routePath || file.id,
    routePath,
    relativePath: routePath,
    projectRelativePath,
    generatedRelativePath: projectRelativePath,
    filename,
    displayName: file.displayName || getGeneratedFileDisplayName(filename),
    versionLabel: file.versionLabel || getGeneratedFileVersionLabel(projectRelativePath),
    fileUrl: file.fileUrl || getGeneratedContentAssetUrl(routePath),
  };
}
