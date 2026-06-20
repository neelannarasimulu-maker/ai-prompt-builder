import type { ParsedSections } from "./content-sections";
import { buildDocumentProductionPrompt } from "./document-prompt-template";

export type DocumentOutputKind = "document" | "pdf";

export type DocumentGenerationContractInput = {
  sections: ParsedSections;
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  outputLabel: string;
  outputType?: DocumentOutputKind;
  logoAsset?: string;
  headerRules?: string;
  footerRules?: string;
  documentBackgroundPrompt?: string;
  typographyRules?: string;
  documentRules?: string;
  tableRules?: string;
  logoRules?: string;
  workflow?: string;
  audience?: string;
  purpose?: string;
  tone?: string;
  brandColours?: string;
};

function firstContentLine(input?: string): string {
  return input?.split("\n").map((line) => line.trim()).find((line) => line && !line.startsWith("#")) || "";
}

/** Backwards-compatible wrapper around the dedicated six-section document template. */
export function buildDocumentGenerationContract(input: DocumentGenerationContractInput): string {
  return buildDocumentProductionPrompt({
    brandName: input.brandLabel,
    projectName: input.projectLabel,
    contentTitle: input.contentLabel,
    outputType: input.outputType || "document",
    documentType: "Professional business document",
    backgroundTheme: input.documentBackgroundPrompt || "Selected document theme",
    workflow: input.workflow || "document_pack",
    audience: input.audience || `Business readers of the ${input.projectLabel} document set.`,
    purpose: input.purpose || `Create the selected ${input.projectLabel} document faithfully.`,
    tone: input.tone || "Professional, clear and business appropriate.",
    brandColours: input.brandColours || "Use the selected brand colours.",
    logoPath: input.logoAsset || "official brand logo",
    headerText: firstContentLine(input.headerRules) || `${input.brandLabel} | ${input.projectLabel}`,
    footerText: firstContentLine(input.footerRules) || input.projectLabel,
  });
}
