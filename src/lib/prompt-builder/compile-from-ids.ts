import { outputProfiles } from "./output-profiles";
import { compilePrompt as compileHydratedPrompt, type CompilePromptInput, type CompiledPromptResult, type PromptCompressionProfile } from "./prompt-compiler";
import { brands, contentItems, projects } from "./registry";
import type { BackgroundTheme } from "./background-themes";

export type CompilePromptByIdInput = {
  brandId: string;
  projectId: string;
  contentId: string;
  outputProfileId: string;
  markdownOverride?: string;
  layoutPresetId?: string;
  backgroundPresetId?: string;
  documentBackgroundPresetId?: string;
  backgroundTheme?: BackgroundTheme;
  compressionProfile?: PromptCompressionProfile;
};

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
  return path
    .replace(/\\/g, "/")
    .replace(/^\.\.\/\.\.\/\.\.\//, "")
    .replace(/^\.\.\//, "")
    .replace(/^\/+/, "");
}

const markdownMap = Object.fromEntries(
  Object.entries(rawMarkdownModules).map(([path, raw]) => [normalizePath(path), raw])
);

const logoSourceMap = Object.fromEntries(
  Object.entries(rawLogoModules).map(([path, raw]) => [normalizePath(path), raw])
);

function getMarkdown(path: string): string {
  return markdownMap[normalizePath(path)] || "";
}

function getBrandFile(brandFolder: string, filename: string): string {
  return getMarkdown(`${brandFolder}/${filename}`);
}

function getLogoSource(brand: { id: string; folder: string; logoAsset?: string; logoPath?: string }): string {
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

function hydrateCompileInput(input: CompilePromptByIdInput): CompilePromptInput {
  const projectMatches = projects.filter((item) => item.id === input.projectId);
  const project = projectMatches.find((item) => item.brandId === input.brandId);
  if (projectMatches.length > 0 && !project) {
    const linkedBrands = projectMatches.map((item) => item.brandId).join(", ");
    throw new Error(`Project ${input.projectId} is not linked to brandId ${input.brandId}. Linked brandId(s): ${linkedBrands}.`);
  }

  const brand = brands.find((item) => item.id === (project?.brandId || input.brandId));
  const content = contentItems.find(
    (item) => item.id === input.contentId && item.brandId === project?.brandId && item.projectId === input.projectId
  );
  const outputProfile = outputProfiles.find((item) => item.id === input.outputProfileId);

  if (!project) throw new Error(`Unknown projectId: ${input.projectId}`);
  if (!brand) throw new Error(`Unknown brandId: ${project.brandId}`);
  if (!content) throw new Error(`Unknown contentId: ${input.contentId}`);
  if (!outputProfile) throw new Error(`Unknown outputProfileId: ${input.outputProfileId}`);

  const brandVisualRules = getBrandFile(brand.folder, "visual-rules.md");
  const projectVisualRules = getMarkdown(`${project.folder}/visual-rules.md`);

  return {
    brandId: brand.id,
    brandLabel: brand.label,
    projectLabel: project.label,
    contentLabel: content.label,
    contentType: content.type,
    outputProfile,
    logoAsset: brand.logoAsset || `content/brands/${brand.id}/assets/${brand.id}-logo.svg`,
    brandLogoAssets: brand.logoAssets.map((asset) => asset.path),
    logoSourceText: getLogoSource(brand),
    brandRules: getBrandFile(brand.folder, "brand.md"),
    headerRules: getBrandFile(brand.folder, "header.md"),
    footerRules: getBrandFile(brand.folder, "footer.md"),
    projectHeaderRules: getMarkdown(`${project.folder}/header.md`),
    projectFooterRules: getMarkdown(`${project.folder}/footer.md`),
    projectLogoRules: getMarkdown(`${project.folder}/logo.md`),
    logoRules: getBrandFile(brand.folder, "logo-rules.md"),
    typographyRules: getBrandFile(brand.folder, "typography.md"),
    documentRules: getBrandFile(brand.folder, "document-rules.md"),
    tableRules: getBrandFile(brand.folder, "table-rules.md"),
    projectRules: getMarkdown(`${project.folder}/project.md`),
    visualRules: [brandVisualRules, projectVisualRules].filter(Boolean).join("\n\n"),
    contentMarkdown: input.markdownOverride ?? getMarkdown(content.path),
    contentFilename: content.file,
    layoutPresetId: input.layoutPresetId,
    backgroundPresetId: input.backgroundPresetId,
    documentBackgroundPresetId: input.documentBackgroundPresetId,
    backgroundTheme: input.backgroundTheme,
    compressionProfile: input.compressionProfile,
  };
}

export function compilePromptFromIds(input: CompilePromptByIdInput): CompiledPromptResult {
  return compileHydratedPrompt(hydrateCompileInput(input));
}
