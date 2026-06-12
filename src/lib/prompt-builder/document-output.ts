import { compactBlock, getSection, ParsedSections } from "./content-sections";

export type DocumentOutputKind = "document" | "pdf";

export type DocumentGenerationContractInput = {
  sections: ParsedSections;
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  outputLabel: string;
  logoAsset?: string;
  headerRules?: string;
  footerRules?: string;
  documentBackgroundPrompt?: string;
  typographyRules?: string;
  documentRules?: string;
  tableRules?: string;
  logoRules?: string;
};

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildDocumentGenerationContract(input: DocumentGenerationContractInput): string {
  const documentOutputRules = getSection(input.sections, "Document Output Rules", "Output Rules");
  const contentConstraints = getSection(input.sections, "Content Constraints", "Constraints");

  const rules = [
    "Create the requested Word/PDF-style document output, not a visual slide.",
    "When a source Markdown file is attached, read the attached file completely before generating the document.",
    "Use the Body Content block in the attached Markdown file as the only document body source of truth.",
    "Preserve all wording, labels, table rows, table columns, empty fields, checklist boxes, scoring values and options exactly as supplied.",
    "Do not summarise, shorten, reorder, rename, merge, remove or add content.",
    "Render Markdown pipe tables as properly formatted Word/PDF tables.",
    "Do not use HTML table tags unless they already exist in the supplied source.",
    "Preserve blank cells as blank fields for completion.",
    "Use A4 portrait page setup unless the MD file says otherwise.",
    "Use repeated brand header and footer on every page.",
    "Include dynamic page numbers in the footer.",
    "Use readable table styling and page-safe spacing so no table text is clipped.",
    "For PDF output, generate it from the same document layout and content.",
  ];

  const blocks = [
    `Brand: ${input.brandLabel}\nProject: ${input.projectLabel}\nContent: ${input.contentLabel}\nOutput: ${input.outputLabel}`,
    input.logoAsset ? `Logo asset:\n${input.logoAsset}` : "Logo asset:\n[No logo asset supplied]",
    input.headerRules ? `Header rules:\n${compactBlock(input.headerRules)}` : "Header rules:\nUse the header stated in the MD Document Output Rules.",
    input.footerRules ? `Footer rules:\n${compactBlock(input.footerRules)}` : "Footer rules:\nUse the footer stated in the MD Document Output Rules and include page numbers.",
    input.documentBackgroundPrompt ? `Document style preset:\n${input.documentBackgroundPrompt}` : "",
    documentOutputRules ? `MD Document Output Rules:\n${compactBlock(documentOutputRules)}` : "",
    contentConstraints ? `Content Constraints:\n${compactBlock(contentConstraints)}` : "",
    `Non-negotiable generation rules:\n${bulletList(rules)}`,
  ];

  return blocks.filter(Boolean).join("\n\n").trim();
}
