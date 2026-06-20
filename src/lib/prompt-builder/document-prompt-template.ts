export type DocumentPromptTemplateInput = {
  brandName: string;
  projectName: string;
  contentTitle: string;
  outputType: "document" | "pdf";
  pageSize?: string;
  orientation?: string;
  documentType: string;
  backgroundTheme: string;
  workflow: string;
  audience: string;
  purpose: string;
  tone: string;
  brandColours: string;
  logoPath: string;
  headerText: string;
  footerText: string;
};

function section(title: string, lines: string[]): string {
  return `${title}\n${lines.filter((line) => line.trim()).join("\n")}`;
}

export function buildDocumentProductionPrompt(input: DocumentPromptTemplateInput): string {
  const isWord = input.outputType === "document";
  const outputFormat = isWord ? "Word document" : "PDF document";
  const extension = isWord ? ".docx" : ".pdf";
  const tableFormat = isWord ? "Word" : "PDF";
  const pageSize = input.pageSize || "A4";
  const orientation = input.orientation || "portrait";

  return [
    section("TASK", [
      `Create one ${pageSize} ${orientation} ${outputFormat} titled "${input.contentTitle}" for ${input.brandName}. Use the ${input.projectName} context.`,
    ]),
    section("SOURCE OF TRUTH", [
      "Use the supplied Markdown source as the exact document source of truth.",
      "Read it completely before creating the document.",
      "Preserve the source wording, headings, numbering, paragraphs, tables, blank fields, options, checkboxes and scoring values exactly.",
      "Do not summarise, shorten, paraphrase, reorder, rename, remove or add content.",
    ]),
    section("BRAND + PROJECT", [
      `Brand: ${input.brandName}`,
      `Project: ${input.projectName}`,
      `Workflow: ${input.workflow}`,
      `Audience: ${input.audience}`,
      `Purpose: ${input.purpose}`,
      `Tone: ${input.tone}`,
      "",
      "Brand colours:",
      input.brandColours,
      "",
      "Logo:",
      `Use the official logo asset: ${input.logoPath}.`,
      "Do not redraw, recolour, stretch, crop, replace or invent the logo.",
      "",
      "Header:",
      input.headerText,
      "",
      "Footer:",
      input.footerText,
    ]),
    section("OUTPUT PROFILE", [
      `Output format: ${outputFormat}`,
      `Return only: ${extension}`,
      `Page size: ${pageSize}`,
      `Orientation: ${orientation[0].toUpperCase()}${orientation.slice(1)}`,
      `Document type: ${input.documentType}`,
      `Page background theme: ${input.backgroundTheme}`,
    ]),
    section("DOCUMENT RENDERING RULES", [
      `* Apply the selected ${input.brandName} document system.`,
      "* Use a polished professional document layout with repeated header and footer.",
      "* Use the official logo in the header where supported.",
      "* Use dynamic page numbering where supported.",
      "* Use document typography only:",
      "  * Document title: approximately 20-24 pt.",
      "  * Major headings: approximately 14-16 pt.",
      "  * Subheadings: approximately 11-12 pt.",
      "  * Body text: approximately 10-11 pt.",
      "  * Header, footer and compact table notes: approximately 8-9 pt.",
      "* Render Markdown headings as document headings.",
      "* Render Markdown paragraphs as document body text.",
      "* Render Markdown lists as document lists.",
      `* Render Markdown pipe tables as properly formatted ${tableFormat} tables.`,
      "* Preserve all table rows, columns, blank cells, options, checkboxes and scoring values exactly.",
      "* Use brand colours for headings, section rules, table headers and restrained accents.",
      "* Use slightly increased spacing between major sections while keeping the document compact and professional.",
      "* Keep each section heading with enough opening content to establish the section on the same page.",
      "* If a section would begin too near the bottom of a page, move the section heading and opening content to the next page.",
      "* Allow sections to continue naturally across pages once they have started.",
      "* Signature sections must begin on a new page.",
      "* Use increased spacing between signature and completion lines so each field is clearly writable.",
      "* Keep the document print-readable and business appropriate.",
    ]),
    section("FINAL OUTPUT REQUIREMENT", [
      "Create the requested document immediately.",
      `Return the completed ${extension} ${outputFormat} only.`,
    ]),
  ].join("\n\n").trim();
}
