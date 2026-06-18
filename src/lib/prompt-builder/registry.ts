export type BrandAssetItem = {
  path: string;
  previewPath: string;
  filename: string;
  extension: string;
  isPng: boolean;
};

export type BrandRegistryItem = {
  id: string;
  label: string;
  folder: string;
  logoPath?: string;
  logoPreviewPath?: string;
  logoAsset?: string;
  logoAssets: BrandAssetItem[];
};

export type ProjectRegistryItem = {
  id: string;
  label: string;
  brandId: string;
  folder: string;
};

export type ContentRegistryItem = {
  id: string;
  label: string;
  brandId: string;
  projectId: string;
  kind: "slides" | "documents" | "linkedin" | "content";
  type: string;
  path: string;
  file: string;
};

const brandMarkdownModules = import.meta.glob("../../../content/brands/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const projectMarkdownModules = import.meta.glob("../../../content/projects/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const brandAssetModules = import.meta.glob("../../../content/brands/**/assets/*.{svg,png,jpg,jpeg,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function normalizePath(input: string): string {
  return input
    .replace(/\\/g, "/")
    .replace(/^\.\.\/\.\.\/\.\.\//, "")
    .replace(/^\.\.\//, "")
    .replace(/^\/+/, "");
}

function titleCase(input: string): string {
  return input
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function titleFromFilename(filename: string): string {
  return titleCase(
    filename
      .replace(/\.md$/i, "")
      .replace(/^\d+[-_ ]*/, "")
  );
}

function contentKindFromFolder(folder: string): ContentRegistryItem["kind"] {
  if (folder === "visuals") return "slides";
  if (folder === "documents") return "documents";
  if (folder === "linkedin") return "linkedin";
  return "content";
}

function brandPrefixForContentId(brandId: string): string {
  if (brandId === "supplysync360") return "ss360";
  return brandId;
}

function contentIdPart(kind: ContentRegistryItem["kind"]): string {
  if (kind === "slides") return "slide";
  if (kind === "documents") return "doc";
  if (kind === "linkedin") return "linkedin";
  return "content";
}

function firstMarkdownHeading(markdown?: string): string {
  if (!markdown) return "";
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || "";
}

function preferredLogoAssetPath(brandId: string): string | undefined {
  const prefix = `content/brands/${brandId}/assets/`;
  const assets = getBrandLogoAssets(brandId).map((asset) => asset.path);

  if (assets.length === 0) return undefined;

  const preferred = [
    `${prefix}${brandId}-logo.png`,
    `${prefix}${brandId}.png`,
    `${prefix}${brandId}-logo-transparent-dark.png`,
    `${prefix}${brandId}-logo-transparent-light.png`,
    `${prefix}${brandId}-logo.svg`,
    `${prefix}${brandId}.svg`,
  ];

  return preferred.find((candidate) => assets.includes(candidate)) || assets.sort()[0];
}

function getBrandLogoAssets(brandId: string): BrandAssetItem[] {
  const prefix = `content/brands/${brandId}/assets/`;

  return Object.entries(brandAssetModules)
    .map(([rawPath, previewPath]) => {
      const path = normalizePath(rawPath);
      const filename = path.split("/").pop() || path;
      const extension = filename.split(".").pop()?.toLowerCase() || "";

      return {
        path,
        previewPath,
        filename,
        extension,
        isPng: extension === "png",
      };
    })
    .filter((asset) => asset.path.startsWith(prefix))
    .sort((a, b) => {
      if (a.isPng !== b.isPng) return a.isPng ? -1 : 1;
      return a.filename.localeCompare(b.filename);
    });
}

function discoverBrandIds(): string[] {
  const ids = new Set<string>();

  for (const rawPath of Object.keys(brandMarkdownModules)) {
    const path = normalizePath(rawPath);
    const match = path.match(/^content\/brands\/([^/]+)\//);
    if (match?.[1]) ids.add(match[1]);
  }

  for (const rawPath of Object.keys(brandAssetModules)) {
    const path = normalizePath(rawPath);
    const match = path.match(/^content\/brands\/([^/]+)\//);
    if (match?.[1]) ids.add(match[1]);
  }

  return Array.from(ids).sort();
}

function discoverProjects(): ProjectRegistryItem[] {
  const projectMap = new Map<string, ProjectRegistryItem>();

  for (const [rawPath, rawMarkdown] of Object.entries(projectMarkdownModules)) {
    const path = normalizePath(rawPath);
    if (path.includes("/generated-content/")) continue;

    const match = path.match(/^content\/projects\/([^/]+)\/([^/]+)\//);
    if (!match) continue;

    const [, brandId, projectId] = match;
    const key = `${brandId}/${projectId}`;
    const folder = `content/projects/${brandId}/${projectId}`;
    const existing = projectMap.get(key);
    const isProjectFile = path === `${folder}/project.md`;
    const heading = isProjectFile ? firstMarkdownHeading(rawMarkdown) : "";

    projectMap.set(key, {
      id: projectId,
      brandId,
      folder,
      label: heading || existing?.label || titleCase(projectId),
    });
  }

  return Array.from(projectMap.values()).sort((a, b) => {
    if (a.brandId !== b.brandId) return a.brandId.localeCompare(b.brandId);
    return a.label.localeCompare(b.label);
  });
}

function discoverContentItems(): ContentRegistryItem[] {
  const items: ContentRegistryItem[] = [];

  for (const rawPath of Object.keys(projectMarkdownModules)) {
    const path = normalizePath(rawPath);
    if (path.includes("/generated-content/")) continue;
    if (path.endsWith("/project.md") || path.endsWith("/visual-rules.md")) continue;

    const match = path.match(/^content\/projects\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+\.md)$/);
    if (!match) continue;

    const [, brandId, projectId, type, file] = match;
    const kind = contentKindFromFolder(type);
    const ordinal = file.match(/^(\d+)/)?.[1] || String(items.length + 1).padStart(2, "0");

    items.push({
      id: `${brandPrefixForContentId(brandId)}-${contentIdPart(kind)}-${ordinal}`,
      label: titleFromFilename(file),
      brandId,
      projectId,
      kind,
      type,
      path,
      file,
    });
  }

  return items.sort((a, b) => {
    if (a.brandId !== b.brandId) return a.brandId.localeCompare(b.brandId);
    if (a.projectId !== b.projectId) return a.projectId.localeCompare(b.projectId);
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.file.localeCompare(b.file);
  });
}

export const brands: BrandRegistryItem[] = discoverBrandIds().map((brandId) => {
  const folder = `content/brands/${brandId}`;
  const brandMarkdown = brandMarkdownModules[`../../../${folder}/brand.md`] || "";
  const logoAssets = getBrandLogoAssets(brandId);
  const logoAsset = preferredLogoAssetPath(brandId);

  return {
    id: brandId,
    label: firstMarkdownHeading(brandMarkdown) || titleCase(brandId),
    folder,
    logoPath: logoAsset,
    logoPreviewPath: logoAsset,
    logoAsset,
    logoAssets,
  };
});

export const projects: ProjectRegistryItem[] = discoverProjects();
export const contentItems: ContentRegistryItem[] = discoverContentItems();

export function getProjectsForBrand(brandId: string): ProjectRegistryItem[] {
  return projects.filter((project) => project.brandId === brandId);
}

export function listBrands(): BrandRegistryItem[] {
  return brands;
}

export function listProjects(brandId?: string): ProjectRegistryItem[] {
  return brandId ? getProjectsForBrand(brandId) : projects;
}
