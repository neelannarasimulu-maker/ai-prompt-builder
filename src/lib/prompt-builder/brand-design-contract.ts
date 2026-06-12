import { compactBlock } from "./content-sections";
import type { OutputType } from "./prompt-compiler";

export type BrandDesignContractInput = {
  outputType: OutputType;
  typographyRules?: string;
  documentRules?: string;
  tableRules?: string;
  visualRules?: string;
  headerRules?: string;
  footerRules?: string;
  logoRules?: string;
};

function titledBlock(title: string, value?: string): string {
  const cleaned = compactBlock(value);
  return cleaned ? `${title}:\n${cleaned}` : "";
}

function stripHeading(input: string): string {
  return input
    .split("\n")
    .filter((line) => !/^#\s+/.test(line.trim()))
    .join("\n")
    .trim();
}

function extractHeadingSection(input: string | undefined, preferredHeading: string): string {
  const source = compactBlock(input);
  if (!source) return "";

  const escaped = preferredHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i");
  const match = source.match(regex);

  if (match?.[2]?.trim()) return match[2].trim();
  return stripHeading(source);
}

function removeLinesContaining(input: string, forbiddenTerms: string[]): string {
  const lowerTerms = forbiddenTerms.map((term) => term.toLowerCase());
  return input
    .split("\n")
    .filter((line) => {
      const lower = line.toLowerCase();
      return !lowerTerms.some((term) => lower.includes(term));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function visualOnlyRules(input: string | undefined): string {
  return removeLinesContaining(compactBlock(input), [
    "docx",
    "word/pdf",
    "word document",
    "pdf output",
    "page number",
    "page numbers",
    "footer on every page",
    "header on every page",
    "contract pack",
    "document body",
    "body content",
  ]);
}

function documentOnlyRules(input: string | undefined): string {
  return removeLinesContaining(compactBlock(input), [
    "visual outputs",
    "visual image",
    "image output",
    "on-image",
    "slide",
    "slides",
    "backgrounds that are too dark",
    "fake dashboards",
  ]);
}

export function buildBrandDesignContract(input: BrandDesignContractInput): string {
  const isDocument = input.outputType === "document" || input.outputType === "pdf";
  const isVisual = input.outputType === "image";
  const blocks: string[] = [];

  blocks.push(
    "Use these brand design rules as styling rules only. Do not treat them as source content. Do not let them replace, summarise, shorten or alter the supplied content."
  );

  if (input.logoRules) blocks.push(titledBlock("Logo rules", input.logoRules));

  if (isDocument) {
    if (input.headerRules) blocks.push(titledBlock("Document header rules", documentOnlyRules(input.headerRules)));
    if (input.footerRules) blocks.push(titledBlock("Document footer rules", documentOnlyRules(input.footerRules)));

    const documentTypography = extractHeadingSection(input.typographyRules, "Document Typography");
    if (documentTypography) blocks.push(titledBlock("Document typography rules", documentTypography));

    if (input.documentRules) blocks.push(titledBlock("Document layout and formatting rules", documentOnlyRules(input.documentRules)));
    if (input.tableRules) blocks.push(titledBlock("Table formatting rules", documentOnlyRules(input.tableRules)));
  }

  if (isVisual) {
    const visualTypography = extractHeadingSection(input.typographyRules, "Visual Typography");
    if (visualTypography) blocks.push(titledBlock("Visual typography rules", visualTypography));

    const visuals = visualOnlyRules(input.visualRules);
    if (visuals) blocks.push(titledBlock("Visual design rules", visuals));
  }

  if (!isDocument && !isVisual) {
    const generalTypography = compactBlock(input.typographyRules);
    if (generalTypography) blocks.push(titledBlock("Typography guidance", removeLinesContaining(generalTypography, ["page number", "on-image", "docx"])));
  }

  return blocks.filter(Boolean).join("\n\n").trim();
}
