import { isIgnoredContentPath, parseContentSetPath } from "../../lib/prompt-builder/content-set-paths";
import { extractLogoAssetPaths } from "../../lib/prompt-builder/logo-resolution";
import type { BrandItem, ContentEntry, ProjectItem } from "../registry/types";

const rawMarkdownModules = import.meta.glob("../../../content/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const rawLogoModules = import.meta.glob("../../../content/brands/**/assets/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^(?:\.\.\/)+/, "");
}

const markdownMap: Record<string, string> = Object.fromEntries(
  Object.entries(rawMarkdownModules).map(([path, raw]) => [normalizePath(path), raw])
);

const logoSourceMap: Record<string, string> = Object.fromEntries(
  Object.entries(rawLogoModules).map(([path, raw]) => [normalizePath(path), raw])
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

export function getBrandFile(brand: BrandItem, fileName: string): string {
  return getMarkdownContent(`${brand.folder}/${fileName}`);
}

export function getProjectFile(project: ProjectItem, fileName: string): string {
  return getMarkdownContent(`${project.folder}/${fileName}`);
}

export function getBrandLogoSource(brand: BrandItem | null): string {
  if (!brand) return "";
  const candidates = [brand.logoAsset, brand.logoPath, `${brand.folder}/assets/${brand.id}-logo.svg`, `${brand.folder}/assets/${brand.id}.svg`].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const normalized = normalizePath(candidate);
    if (logoSourceMap[normalized]) return logoSourceMap[normalized];
  }
  return "";
}

export function firstLogoAssetPath(markdown: string): string {
  return extractLogoAssetPaths(markdown)[0] || "";
}

export function logoNotesFromMarkdown(markdown: string): string {
  const firstPath = firstLogoAssetPath(markdown);
  return markdown
    .replace(/^#\s+Project Logo\s*$/im, "")
    .replace(/^Logo asset:\s*.*$/im, "")
    .replace(/`?content\/(?:brands|projects)\/[^\s`'"<>)]+\.(?:png|svg|jpg|jpeg|webp)`?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || (firstPath ? "" : markdown.trim());
}

export function buildProjectLogoMarkdown(assetPath: string, notes: string): string {
  return ["# Project Logo", "", assetPath ? `Logo asset: ${assetPath}` : "", "", notes.trim()]
    .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1))
    .join("\n").trim() + "\n";
}

export function getProjectContentEntries(project: ProjectItem): ContentEntry[] {
  const prefix = `${project.folder}/`;
  return Object.entries(markdownMap)
    .filter(([path]) => path.startsWith(prefix))
    .filter(([path]) => !isIgnoredContentPath(path))
    .filter(([path]) => !["/project.md", "/visual-rules.md", "/header.md", "/footer.md", "/logo.md"].some((suffix) => path.toLowerCase().endsWith(suffix)))
    .flatMap(([path, raw]): ContentEntry[] => {
      const parsed = parseContentSetPath(path);
      if (!parsed || parsed.isDescriptor) return [];
      return [{ path, type: parsed.type, contentSet: parsed.contentSet, filename: parsed.filename, label: titleFromFileName(parsed.filename), raw }];
    })
    .sort((a, b) => a.type.localeCompare(b.type) || a.filename.localeCompare(b.filename));
}
