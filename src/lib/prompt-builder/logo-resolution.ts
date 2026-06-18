export type LogoResolutionOutputType = "image" | "document" | "pdf" | "text" | "email";

export type ResolvedLogoAsset = {
  asset: string;
  source: "content" | "project" | "brand-rules" | "registry" | "none";
  usageNote: string;
  isOutsideBrandAssets: boolean;
  svgHasPngAlternative: boolean;
};

const LOGO_PATH_RE = /content\/(?:brands|projects)\/[^\s`'"<>)]+\.(?:png|svg|jpg|jpeg|webp)/gi;

function compact(input?: string): string {
  return (input || "").replace(/\r\n/g, "\n").trim();
}

function normalizePath(input?: string): string {
  return (input || "").replace(/\\/g, "/").trim();
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const path of paths.map(normalizePath).filter(Boolean)) {
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(path);
  }

  return output;
}

export function extractLogoAssetPaths(markdown?: string): string[] {
  return uniquePaths(compact(markdown).match(LOGO_PATH_RE) || []);
}

function pngSibling(path?: string): string {
  const normalized = normalizePath(path);
  return normalized.replace(/\.svg$/i, ".png");
}

function isPng(path: string): boolean {
  return /\.png$/i.test(path);
}

function isSvg(path: string): boolean {
  return /\.svg$/i.test(path);
}

function preferPng(paths: string[]): string {
  return paths.find(isPng) || paths[0] || "";
}

function chooseBrandRulePath(input: {
  paths: string[];
  outputType: LogoResolutionOutputType;
  backgroundText?: string;
}): string {
  const pngs = input.paths.filter(isPng);
  if (pngs.length === 0) return input.paths[0] || "";

  if (input.outputType === "document" || input.outputType === "pdf") {
    return pngs.find((path) => /transparent-light|light/i.test(path)) || pngs[0];
  }

  if (input.outputType === "image") {
    const background = (input.backgroundText || "").toLowerCase();
    if (/\blight\b/.test(background) && !/\bdark\b/.test(background)) {
      return pngs.find((path) => /transparent-light|light/i.test(path)) || pngs[0];
    }
    if (/\bdark\b/.test(background)) {
      return pngs.find((path) => /transparent-dark|dark/i.test(path)) || pngs[0];
    }
    const looksLight = /\b(white|pale|soft sand|light document|clean white|mist|cream)\b/.test(background);
    const looksDeep = /\b(dark|navy|teal|image-based|executive depth|depth|gradient)\b/.test(background);
    if (looksLight && !looksDeep) {
      return pngs.find((path) => /transparent-light|light/i.test(path)) || pngs[0];
    }
    return pngs.find((path) => /transparent-dark|dark/i.test(path)) || pngs[0];
  }

  return preferPng(pngs);
}

function usageNoteFor(asset: string, outputType: LogoResolutionOutputType): string {
  if (!asset) return "Use clean text branding if no official logo asset is available.";

  const fileType = isPng(asset) ? "PNG" : asset.toLowerCase().endsWith(".svg") ? "SVG" : "image";
  const surface = outputType === "image" ? "slide" : outputType === "document" || outputType === "pdf" ? "page" : "output";
  const variantNote = /transparent-dark/i.test(asset)
    ? "Use the light-background logo variant only on pale or white headers."
    : /transparent-light/i.test(asset)
      ? "Use the dark-background logo variant only on navy, teal or image-based headers."
      : "";

  return [
    `use official ${fileType} asset ${asset} in the header on every ${surface};`,
    variantNote,
    "do not redraw, recolour, stretch, replace, crop or invent a logo.",
  ].filter(Boolean).join(" ");
}

export function resolvePromptLogoAsset(input: {
  outputType: LogoResolutionOutputType;
  brandId?: string;
  brandLogoAsset?: string;
  brandLogoAssetPaths?: string[];
  contentLogoRules?: string;
  projectLogoRules?: string;
  brandLogoRules?: string;
  backgroundText?: string;
}): ResolvedLogoAsset {
  const withMetadata = (asset: string, source: ResolvedLogoAsset["source"]): ResolvedLogoAsset => {
    const normalizedAsset = normalizePath(asset);
    const normalizedBrandAssets = (input.brandLogoAssetPaths || []).map(normalizePath);
    const brandPrefix = input.brandId ? `content/brands/${input.brandId}/assets/`.toLowerCase() : "";
    const isOutsideBrandAssets = Boolean(
      normalizedAsset &&
      brandPrefix &&
      !normalizedAsset.toLowerCase().startsWith(brandPrefix)
    );
    const svgPngSibling = pngSibling(normalizedAsset);
    const svgHasPngAlternative = Boolean(
      normalizedAsset &&
      isSvg(normalizedAsset) &&
      normalizedBrandAssets.some((path) => path.toLowerCase() === svgPngSibling.toLowerCase())
    );

    return {
      asset: normalizedAsset,
      source,
      usageNote: usageNoteFor(normalizedAsset, input.outputType),
      isOutsideBrandAssets,
      svgHasPngAlternative,
    };
  };

  const contentPaths = extractLogoAssetPaths(input.contentLogoRules);
  if (contentPaths.length > 0) {
    const asset = preferPng(contentPaths);
    return withMetadata(asset, "content");
  }

  const projectPaths = extractLogoAssetPaths(input.projectLogoRules);
  if (projectPaths.length > 0) {
    const asset = preferPng(projectPaths);
    return withMetadata(asset, "project");
  }

  const brandRulePaths = extractLogoAssetPaths(input.brandLogoRules);
  if (brandRulePaths.length > 0) {
    const asset = chooseBrandRulePath({
      paths: brandRulePaths,
      outputType: input.outputType,
      backgroundText: input.backgroundText,
    });
    return withMetadata(asset, "brand-rules");
  }

  const registryAsset = normalizePath(input.brandLogoAsset);
  if (registryAsset) {
    const asset = registryAsset.toLowerCase().endsWith(".svg") ? pngSibling(registryAsset) : registryAsset;
    return withMetadata(asset, "registry");
  }

  return withMetadata("", "none");
}
