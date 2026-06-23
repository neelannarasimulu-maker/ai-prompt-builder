import {
  compactBlock,
  compactSentence,
  detectedMarkdownSectionHeadings,
  getSection,
  ignoredLegacyOutputRuleSections,
  linesFromBlock,
  parseMarkdownSections,
  ParsedSections,
} from "./content-sections";
import { getBackgroundPreset, type BackgroundPreset } from "./background-presets";
import {
  getDocumentBackgroundPreset,
  type DocumentBackgroundPreset,
} from "./document-background-presets";
import {
  getBackgroundTheme,
  inferBackgroundThemeFromPreset,
  type BackgroundTheme,
  type BackgroundThemeDefinition,
} from "./background-themes";
import { getLayoutPreset, type LayoutPreset } from "./layout-presets";
import { solveDynamicLayout, type DynamicLayoutPlan } from "./layout-solver";
import {
  buildRenderContract,
  renderContractToPrompt,
  type RenderContract,
} from "./render-contract";
import { buildDocumentProductionPrompt } from "./document-prompt-template";
import { buildBrandDesignContract } from "./brand-design-contract";
import {
  splitDocumentBodyIntoChunks,
  type DocumentPromptParts,
} from "./document-prompt-parts";
import { lintCompiledPrompt, type PromptLintResult } from "./prompt-lint";
import { resolvePromptLogoAsset } from "./logo-resolution";
import { buildLinkedInProductionPrompt } from "./linkedin-prompt-template";
import { getMasterFrameSpec } from "./master-frame";
import {
  buildVisualProductionPrompt,
  type VisualGenerationMode,
} from "./visual-prompt-template";

export type OutputType = "image" | "document" | "pdf" | "text" | "email";

export type OutputProfileLike = {
  id: string;
  label: string;
  outputType: OutputType;
  format?: string;
  useCase?: string;
  instruction?: string;
  promptInstruction?: string;
  safeMargins?: string;
  typography?: string;
};

export type PromptCompressionProfile = "compact" | "expanded" | "singleMessageDocument";

export type CompilePromptInput = {
  brandId?: string;
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  contentType: string;
  outputProfile: OutputProfileLike;
  logoAsset?: string;
  brandLogoAssets?: string[];
  logoSourceText?: string;
  brandRules?: string;
  headerRules?: string;
  footerRules?: string;
  projectHeaderRules?: string;
  projectFooterRules?: string;
  projectLogoRules?: string;
  logoRules?: string;
  typographyRules?: string;
  documentRules?: string;
  projectDocumentRules?: string;
  tableRules?: string;
  projectRules?: string;
  visualRules?: string;
  contentMarkdown: string;
  contentFilename?: string;
  layoutPresetId?: string;
  backgroundPresetId?: string;
  documentBackgroundPresetId?: string;
  backgroundTheme?: BackgroundTheme;
  generationMode?: VisualGenerationMode;
  safeMargins?: string;
  compressionProfile?: PromptCompressionProfile;
};

export type CompiledPromptResult = {
  prompt: string;
  productionPrompt: string;
  debugPrompt: string;
  actionPrompt: string;
  contractPrompt: string;
  warnings: string[];
  promptLint: PromptLintResult;
  fidelityScore: number;
  promptPreview: {
    visibleText: string;
    bodyContent: string;
    guidance: string;
    headerText: string;
    footerText: string;
    brandColours: string;
    logoAsset: string;
    backgroundTheme: string;
    detectedSections: string[];
    ignoredLegacySections: string[];
    coverPageContent: string;
    tableOfContentsContent: string;
    linkedinPostText: string;
  };
  sections: ParsedSections;
  dynamicLayoutPlan: DynamicLayoutPlan;
  renderContract: RenderContract;
  resolvedLayoutPreset: LayoutPreset;
  resolvedBackgroundPreset: BackgroundPreset;
  resolvedDocumentBackgroundPreset: DocumentBackgroundPreset;
  resolvedBackgroundTheme: BackgroundThemeDefinition;
  documentPromptParts: DocumentPromptParts;
  promptStats: {
    characters: number;
    words: number;
    visibleTextLines: number;
  };
};

function estimateWords(input: string): number {
  return input.trim() ? input.trim().split(/\s+/).length : 0;
}

function isDocumentLike(outputType: OutputType): boolean {
  return outputType === "document" || outputType === "pdf";
}

function isTextLike(outputProfile: OutputProfileLike): boolean {
  return outputProfile.outputType === "text" || outputProfile.outputType === "email";
}

function isLinkedInImage(outputProfile: OutputProfileLike): boolean {
  return outputProfile.outputType === "image" && outputProfile.id.startsWith("linkedin_");
}

function getOutputLabel(outputProfile: OutputProfileLike): string {
  return outputProfile.format || outputProfile.label || outputProfile.id;
}

function getOutputInstruction(outputProfile: OutputProfileLike): string {
  return compactSentence(outputProfile.instruction || outputProfile.promptInstruction || "");
}

function normalizeForDedup(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9|:#.%()\- ]+/g, "")
    .trim();
}

function addBlock(bucket: string[], title: string, value?: string): void {
  const cleaned = compactBlock(value);
  if (!cleaned) return;

  const candidate = `${title}:\n${cleaned}`;
  const normalized = normalizeForDedup(candidate);
  if (!bucket.some((item) => normalizeForDedup(item) === normalized)) {
    bucket.push(candidate);
  }
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const line of lines) {
    const cleaned = compactSentence(line);
    if (!cleaned) continue;
    const normalized = normalizeForDedup(cleaned);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(cleaned);
  }

  return output;
}

function meaningfulParagraphs(input?: string): string[] {
  const cleaned = compactBlock(input);
  if (!cleaned) return [];

  return cleaned
    .split(/\n\n+/)
    .map((paragraph) => paragraph
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^#{1,6}\s+/.test(line))
      .filter((line) => !/^```/.test(line))
      .filter((line) => !/^`[^`]+`$/.test(line))
      .filter((line) => !/^[-*]\s+/.test(line))
      .filter((line) => !/^\|.*\|$/.test(line))
      .join(" "))
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function firstParagraph(input?: string): string {
  return meaningfulParagraphs(input)[0] || "";
}

function usefulSnippet(input?: string, maxWords = 22): string {
  const snippet = limitWords(firstParagraph(input), maxWords);
  if (!snippet) return "";
  if (/^[A-Za-z][A-Za-z /-]+:\s*$/.test(snippet)) return "";
  return snippet;
}

function buildShortVisualBrandStyle(visualRules?: string): string {
  return firstSentence(firstParagraph(visualRules)) ||
    "Use premium executive styling appropriate to the brand.";
}

function firstSentence(input?: string): string {
  const source = compactSentence(input);
  if (!source) return "";
  return source.split(/(?<=[.!?])\s+/)[0]?.trim() || source;
}

function firstMeaningfulContentLine(input?: string): string {
  const source = compactBlock(input);
  if (!source) return "";
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#{1,6}\s+/.test(line))
    .find((line) => !/^use\b|^for\b|^do not\b/i.test(line)) || "";
}

function extractLabelValue(input: string | undefined, label: string): string {
  const source = compactBlock(input);
  const line = source
    .split("\n")
    .map((item) => item.replace(/^[-*]\s+/, "").trim())
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line?.slice(line.indexOf(":") + 1).trim() || "";
}

function extractMarkdownSubsection(input: string | undefined, heading: string): string {
  const lines = compactBlock(input).split("\n");
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`);
  if (start < 0) return "";
  const endOffset = lines.slice(start + 1).findIndex((line) => /^##\s+/.test(line.trim()));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join("\n").trim();
}

function buildProjectContext(input: CompilePromptInput): string {
  const lines = compactBlock(input.projectRules)
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .filter((line) => normalizeForDedup(line) !== normalizeForDedup(input.projectLabel))
    .filter((line) => !/^(brand|project|tone)\s*:/i.test(line));
  return limitWords(lines.slice(0, 3).join(" "), 55);
}

function resolveDocumentType(contentKind: string, contentLabel: string): string {
  if (contentKind === "legal_document") return "Agreement or legal/business document";
  if (contentKind === "document_template") return "Document template";
  if (contentKind === "commercial_document") return "Commercial document";
  const label = contentLabel.toLowerCase();
  if (label.includes("proposal")) return "Proposal";
  if (label.includes("report")) return "Report";
  if (label.includes("business case")) return "Business case";
  if (label.includes("one-pager") || label.includes("one pager")) return "One-pager";
  if (label.includes("agreement")) return "Agreement";
  return "Professional business document";
}

function buildVisualFontRules(typographyRules?: string): string {
  const visualTypography = extractMarkdownSubsection(typographyRules, "Visual Typography");
  const source = visualTypography || filterLinesContaining(typographyRules, [
    "document title", "document descriptor", "heading 1", "heading 2", "heading 3",
    "body text", "small text", "footer text", "spacing before", "spacing after",
  ]);
  return limitWords(compactSentence(source.replace(/^[-*]\s+/gm, "")), 58) || "Use clear, readable brand typography with strong title-to-body hierarchy.";
}

function buildVisualFontStyle(typographyRules?: string): string {
  const source = extractMarkdownSubsection(typographyRules, "Visual Typography") || compactBlock(typographyRules);
  const styleLine = source
    .split("\n")
    .map(cleanMarkdownLine)
    .find((line) => /font|sans-serif|montserrat|aptos|open sans/i.test(line) && !/:$/.test(line));
  return limitWords(styleLine?.replace(/^use\s+/i, "") || "Clean executive sans-serif typography.", 20);
}

function buildOutputTypographyRules(outputProfile: OutputProfileLike, typographyRules?: string): string {
  const profileRules = compactBlock(outputProfile.typography);
  if (isLinkedInImage(outputProfile)) {
    return profileRules || "Use large, high-contrast, mobile-readable LinkedIn typography.";
  }

  if (isDocumentLike(outputProfile.outputType)) {
    return profileRules || "Use clear executive document typography with a readable A4 hierarchy.";
  }

  const brandRules = extractMarkdownSubsection(typographyRules, "Visual Typography");
  return [profileRules, compactBlock(brandRules)].filter(Boolean).join("\n") ||
    buildVisualFontRules(typographyRules);
}

function sanitizeLinkedInVisibleText(input: string): string {
  return input
    .split("\n")
    .filter((line) => !/^\s*(?:asset\s+(?:format|frame)|format)\s*:/i.test(line))
    .join("\n")
    .trim();
}

function backgroundModeSummary(theme: BackgroundThemeDefinition): string {
  if (theme.id === "light") return "Use the preset in a bright, brand-tinted light mode with highly readable text zones.";
  if (theme.id === "dark") return "Use the preset in a deep brand-toned mode with protected high-contrast text zones.";
  return "Use the preset in a balanced light-to-medium mode with clear brand depth and readable text zones.";
}

function extractInlineCode(input?: string): string {
  const source = compactBlock(input);
  const match = source.match(/`([^`]+)`/);
  return match?.[1]?.trim() || "";
}

function resolveHeaderFooterText(input: {
  contentValue?: string;
  projectValue?: string;
  brandValue?: string;
  fallback: string;
}): string {
  return compactSentence(
    input.contentValue ||
    extractInlineCode(input.projectValue) ||
    firstMeaningfulContentLine(input.projectValue) ||
    extractInlineCode(input.brandValue) ||
    firstMeaningfulContentLine(input.brandValue) ||
    input.fallback
  );
}

function limitWords(input: string | undefined, maxWords: number): string {
  const words = compactSentence(input).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  const clipped = words
    .slice(0, maxWords)
    .join(" ")
    .replace(/\b(and|or|with|for|to|of|the|a|an)$/i, "")
    .replace(/[,:;|-]+$/g, "")
    .trim();
  return `${clipped}.`;
}

function cleanMarkdownLine(input: string): string {
  return input
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBrandColours(input: {
  brandRules?: string;
  typographyRules?: string;
  documentRules?: string;
  tableRules?: string;
  visualRules?: string;
}): string {
  const primarySources = [input.brandRules, input.typographyRules, input.documentRules, input.tableRules];

  for (const source of primarySources) {
    const lines = compactBlock(source).split("\n").map(cleanMarkdownLine).filter(Boolean);
    const paletteLine = lines.find((line) => /^palette\s*:/i.test(line));
    if (paletteLine) {
      return limitWords(paletteLine.replace(/^palette\s*:\s*/i, ""), 36);
    }
  }

  const source = compactBlock([
    input.brandRules,
    input.typographyRules,
    input.documentRules,
    input.tableRules,
    input.visualRules,
  ].filter(Boolean).join("\n"));
  const linesWithHex = source
    .split("\n")
    .map(cleanMarkdownLine)
    .filter((line) => /#[0-9a-f]{6}\b/i.test(line))
    .slice(0, 4);

  if (linesWithHex.length > 0) {
    return limitWords(linesWithHex.join("; "), 36);
  }

  return "derive colours from the supplied official logo and keep the palette consistent with the brand asset.";
}

function filterLinesContaining(input: string | undefined, forbiddenTerms: string[]): string {
  const source = compactBlock(input);
  if (!source) return "";
  const terms = forbiddenTerms.map((term) => term.toLowerCase());

  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#{1,6}\s+/.test(line))
    .filter((line) => {
      const lower = line.toLowerCase();
      return !terms.some((term) => lower.includes(term));
    })
    .join("\n")
    .trim();
}

function removeSentencesContaining(input: string | undefined, forbiddenTerms: string[]): string {
  const source = compactBlock(input);
  if (!source) return "";
  const terms = forbiddenTerms.map((term) => term.toLowerCase());

  return source
    .split(/(?<=[.!?])\s+/g)
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return !terms.some((term) => lower.includes(term));
    })
    .join(" ")
    .trim();
}

function buildBrandSummary(input: CompilePromptInput): string {
  const pieces = [
    firstParagraph(removeSentencesContaining(input.brandRules, ["logo asset", "header", "footer", "body content", "document typography", "logo assets"])),
    firstParagraph(removeSentencesContaining(input.projectRules, ["logo asset", "header", "footer", "body content", "document typography", "logo assets"])),
  ].filter(Boolean);

  return dedupeLines(pieces).join(" ");
}

function shouldEmbedLogoSource(logoSourceText?: string): boolean {
  const source = logoSourceText?.trim();
  if (!source) return false;
  if (source.length > 16000) return false;
  if (/data:image\/(png|jpe?g|webp);base64/i.test(source)) return false;
  return true;
}

function buildLogoReferenceBlock(input: CompilePromptInput): string {
  const lines = [
    input.logoAsset ? `Logo asset path: ${input.logoAsset}` : "Logo asset path: [not supplied]",
    "Use the supplied official logo asset where supported. Do not redraw, recolour, stretch or distort it.",
  ];

  if (!input.logoAsset && shouldEmbedLogoSource(input.logoSourceText)) {
    lines.push("If the environment cannot render the file asset directly, use the supplied official logo source if available; otherwise use clean text branding.");
  }

  return lines.join("\n");
}

function buildBrandCapsule(input: {
  outputType: OutputType;
  brandId?: string;
  brandLabel: string;
  projectLabel?: string;
  logoAsset?: string;
  logoUsageNote?: string;
  brandRules?: string;
  projectRules?: string;
  typographyRules?: string;
  documentRules?: string;
  tableRules?: string;
  visualRules?: string;
  headerRules?: string;
  footerRules?: string;
  resolvedHeaderText: string;
  resolvedFooterText: string;
  outputTypographyRules: string;
}): string {
  const brandColours = extractBrandColours(input);
  const brandBase = limitWords(
    [
      firstParagraph(input.brandRules),
      firstParagraph(input.projectRules),
    ].filter(Boolean).join(" "),
    58
  );

  const documentTone = usefulSnippet(
    filterLinesContaining(input.documentRules, [input.outputType === "document" ? "pdf" : "word"]),
    32
  );
  const tableRules = usefulSnippet(input.tableRules, 22);
  const logo = input.logoAsset
    ? `Logo: ${input.logoUsageNote || `use official asset ${input.logoAsset} in the header on every page; do not redraw, recolour, stretch, replace, crop or invent a logo.`}`
    : "Logo: use clean text branding if no official asset is available.";
  const brandLine = brandBase || `Brand: ${input.brandLabel}.`;
  const colourLine = `Brand colours: ${brandColours}`;

  if (input.outputType === "document" || input.outputType === "pdf") {
    return [
      brandLine,
      colourLine,
      `Header on every page: ${input.resolvedHeaderText}`,
      `Footer on every page: ${input.resolvedFooterText}`,
      documentTone ? `Document style: ${documentTone}` : "",
      `Typography for this output:\n${input.outputTypographyRules}`,
      tableRules ? `Tables: ${tableRules}` : "Tables: render Markdown tables as formatted document tables.",
      logo,
    ].filter(Boolean).join("\n");
  }

  return [
    brandLine,
    colourLine,
    "Voice: concise, commercially grounded, clear, and faithful to the supplied content.",
    "Claims: do not invent proof points, client names, metrics, or facts.",
  ].join("\n");
}

function buildCompactSourceOfTruth(outputProfile: OutputProfileLike): string {
  if (outputProfile.outputType === "image") {
    return "Use only the text inside BEGIN EXACT VISIBLE TEXT / END EXACT VISIBLE TEXT as on-image text. Everything else is design guidance.";
  }

  if (isDocumentLike(outputProfile.outputType)) {
    return "Use the attached Markdown file as the source of truth. Read it completely, use its named content sections as instructed, and preserve headings, paragraphs, tables, blank fields, options, checkboxes, and scoring values exactly.";
  }

  return "Use only the supplied content as source material. Do not add unsupported claims or invented facts.";
}

function outputSurfaceInstruction(outputProfile: OutputProfileLike): string {
  if (outputProfile.outputType === "image") {
    return `Create one ${getOutputLabel(outputProfile)} slide.`;
  }

  if (outputProfile.outputType === "document") {
    return "Create one A4 Word document and return a .docx file only.";
  }

  if (outputProfile.outputType === "pdf") {
    return "Create one A4 PDF document and return a .pdf file only.";
  }

  return `Create ${getOutputLabel(outputProfile)}.`;
}

function buildTask(input: {
  outputProfile: OutputProfileLike;
  contentLabel: string;
  brandLabel: string;
  projectLabel: string;
}): string {
  if (input.outputProfile.outputType === "image") {
    return `Create one ${getOutputLabel(input.outputProfile)} slide titled "${input.contentLabel}" for ${input.brandLabel}. Use the ${input.projectLabel} context.`;
  }

  if (input.outputProfile.outputType === "document") {
    return `Create one A4 Word document titled "${input.contentLabel}" for ${input.brandLabel} and return .docx only. Use the ${input.projectLabel} context.`;
  }

  if (input.outputProfile.outputType === "pdf") {
    return `Create one A4 PDF document titled "${input.contentLabel}" for ${input.brandLabel} and return .pdf only. Use the ${input.projectLabel} context.`;
  }

  return `Create ${getOutputLabel(input.outputProfile)} titled "${input.contentLabel}" for ${input.brandLabel}. Use the ${input.projectLabel} context.`;
}

function buildOutputDirection(input: {
  outputProfile: OutputProfileLike;
  resolvedDocumentBackgroundPreset: DocumentBackgroundPreset;
  resolvedBackgroundTheme: BackgroundThemeDefinition;
  projectDocumentRules?: string;
  contentConstraints?: string;
}): string {
  if (isDocumentLike(input.outputProfile.outputType)) {
    return [
      outputSurfaceInstruction(input.outputProfile),
      `Page background theme: ${input.resolvedBackgroundTheme.label}. ${input.resolvedBackgroundTheme.documentPrompt}`,
      `Document style refinement: ${limitWords(firstSentence(input.resolvedDocumentBackgroundPreset.prompt), 28)}`,
      input.projectDocumentRules ? `Project document rules: ${limitWords(compactSentence(filterLinesContaining(
        input.projectDocumentRules,
        [input.outputProfile.outputType === "document" ? "pdf" : "word"]
      )), 70)}` : "",
      `Document rendering rules:\n${buildDocumentFinalRules(input.outputProfile)}`,
    ].filter(Boolean).join("\n");
  }

  return [
    `Format: ${getOutputLabel(input.outputProfile)}.`,
    getOutputInstruction(input.outputProfile),
    input.contentConstraints ? `Constraints: ${limitWords(input.contentConstraints, 32)}` : "",
  ].filter(Boolean).join("\n");
}

function buildCompactPrompt(input: {
  task: string;
  sourceOfTruth: string;
  brandCapsule: string;
  outputDirection: string;
  contentBlocks: string[];
}): string {
  return [
    `TASK\n${input.task}`,
    `SOURCE OF TRUTH\n${input.sourceOfTruth}`,
    `BRAND CAPSULE\n${input.brandCapsule}`,
    `OUTPUT DIRECTION\n${input.outputDirection}`,
    `CONTENT\n${input.contentBlocks.filter(Boolean).join("\n\n")}`,
  ].join("\n\n").trim();
}

function buildDocumentFinalRules(outputProfile: OutputProfileLike): string {
  const wordOutput = outputProfile.outputType === "document";
  const fileRules = wordOutput
    ? [
        "Generate and return a .docx Word document only.",
        "Render Markdown pipe tables as properly formatted Word tables.",
      ]
    : [
        "Generate and return a .pdf PDF document only.",
        "Render Markdown pipe tables as properly formatted PDF tables.",
      ];
  return dedupeLines([
    "DIRECT CHATGPT FALLBACK ONLY. The production app owns A4 size, repeated chrome, page numbers and the real logo; never print chrome instructions as body content.",
    "Create the requested document immediately from the supplied Markdown source.",
    ...fileRules,
    "Use ## Cover Page Content only for the cover page when present or when the selected profile/template requires a cover page.",
    "If ## Table of Contents is present, use it as the table of contents content.",
    "If ## Table of Contents is not present and the selected document template requires a table of contents, generate one from the headings inside ## Body Content.",
    "Use ## Body Content as the exact legal/business document body source of truth.",
    "Do not print frontmatter, metadata, Intent, Layout Hint, Background Hint or legacy Document Output Rules as body content.",
    "Do not summarise, shorten, reorder, rename, remove or add content.",
    "Insert a page break after the cover page.",
    "Insert a page break after the table of contents.",
    "Start ## Body Content on the page after the table of contents.",
    "Do not duplicate the cover page, table of contents or agreement title.",
    "Let all ## Body Content sections flow continuously in source order; do not insert a page break before every numbered or top-level section.",
    "Use slightly increased spacing between major sections for readability, while keeping the document compact and professional.",
    "Keep each section heading with enough of its opening paragraph or clause to establish the section on the same page.",
    "If a section would begin too near the bottom of a page and immediately continue onto the next page, move that section heading and its opening content to the next page instead.",
    "After a section has started with meaningful content, allow it to continue naturally across pages when necessary.",
    "Signature sections must begin on a new page. Use increased spacing between signature/completion lines so each field is clearly writable.",
    "Preserve all heading and clause numbering exactly as supplied.",
    "For direct ChatGPT fallback, use the supplied brand header, footer, logo and table styling guidance.",
    "For direct ChatGPT fallback, use repeated headers, footers and dynamic page numbering where supported.",
  ]).map((line) => `- ${line}`).join("\n");
}

function buildTextFinalRules(): string {
  return dedupeLines([
    "Keep the result clear, concise and aligned to the supplied content.",
    "Do not add unsupported claims.",
  ]).map((line) => `- ${line}`).join("\n");
}

function promptModeLabel(outputProfile: OutputProfileLike): string {
  if (outputProfile.outputType === "image") return "Exact Image Prompt";
  if (outputProfile.outputType === "document") return "Exact Document Prompt";
  if (outputProfile.outputType === "pdf") return "Exact PDF Prompt";
  return "Exact Text/Email Prompt";
}

function buildSourceOfTruthRules(outputProfile: OutputProfileLike): string {
  if (outputProfile.outputType === "image") {
    return [
      "The only text allowed inside the generated image is the text between BEGIN EXACT VISIBLE TEXT and END EXACT VISIBLE TEXT.",
      "All other sections are styling, layout, brand, and scene guidance only.",
      "Do not add, remove, rewrite, reorder, summarize, or embellish visible wording.",
    ].join("\n");
  }

  if (isDocumentLike(outputProfile.outputType)) {
    return [
      "Use ## Cover Page Content only for the cover page when present or when the selected profile/template requires a cover page.",
      "If ## Table of Contents is present, use it as the table of contents content.",
      "If ## Table of Contents is not present and the selected document template requires a table of contents, generate one from the headings inside ## Body Content.",
      "The document body source of truth is the ## Body Content section inside the attached Markdown file.",
      "If Body Content is absent, use Visible Text as the fallback body source.",
      "Do not print frontmatter, prompt-builder metadata, Intent, Layout Hint, Background Hint or legacy Document Output Rules as document body content.",
      "Brand, layout, header, footer, logo and table rules are injected by the prompt template as formatting guidance only.",
    ].join("\n");
  }

  return [
    "Use the supplied content as the source of truth.",
    "Do not add unsupported claims, invented metrics, invented client names, or facts not present in the source.",
  ].join("\n");
}

function buildValidationRules(outputProfile: OutputProfileLike, deckLocked = false): string {
  if (outputProfile.outputType === "image") {
    return [
      "Before finalizing, verify that every visible word in the image matches the Exact Visible Text block.",
      "Verify that brand rules are applied without turning guidance text into visible text.",
      deckLocked ? "Verify header/footer/logo/margins match the fixed deck master and variation appears only in the body area." : "",
    ].filter(Boolean).join("\n");
  }

  if (isDocumentLike(outputProfile.outputType)) {
    return [
      "Before finalizing, verify that every heading, paragraph, table row, blank cell, checkbox, option, and score from Body Content is preserved.",
      "Verify cover page content is used only on the cover page when supplied.",
      "Verify that Markdown pipe tables are rendered as formatted document tables.",
      "Verify body sections flow continuously, headings are not stranded at page bottoms, and signature blocks are not split across pages.",
    ].join("\n");
  }

  return "Before finalizing, verify that the output follows the requested format and contains no unsupported claims.";
}

function buildStrictPrompt(input: {
  modeLabel: string;
  task: string;
  context: string;
  outputFormat: string;
  sourceOfTruthRules: string;
  nonNegotiableRules: string;
  contentBlocks: string[];
  validationRules: string;
}): string {
  return [
    `ROLE\nYou are ChatGPT acting as a precise branded-output generator. Follow the source content exactly.`,
    `TASK\n${input.task}`,
    `CONTEXT\n${input.context}`,
    `OUTPUT FORMAT\n${input.modeLabel}: ${input.outputFormat}`,
    `SOURCE OF TRUTH\n${input.sourceOfTruthRules}`,
    `NON-NEGOTIABLE RULES\n${input.nonNegotiableRules}`,
    `CONTENT\n${input.contentBlocks.filter(Boolean).join("\n\n")}`,
    `VALIDATION CHECK\n${input.validationRules}`,
  ].join("\n\n").trim();
}

function buildActionPrompt(input: { outputProfile: OutputProfileLike; logoAsset?: string }): string {
  if (isDocumentLike(input.outputProfile.outputType)) {
    return [
      "Action steps:",
      "1. Copy the Production prompt.",
      "2. Attach the selected source Markdown file to ChatGPT.",
      "3. Paste and run the Production prompt. It tells ChatGPT to read the attachment completely and create the document immediately.",
      input.logoAsset
        ? `4. Use the official logo asset where supported: ${input.logoAsset}`
        : "4. Use the brand header text if no logo asset is available.",
      "5. Download the completed file and save it using the suggested output filename.",
    ].join("\n");
  }

  if (input.outputProfile.outputType === "image") {
    return [
      "Action steps:",
      "1. Review the compiled Production prompt.",
      "2. Copy the prompt into ChatGPT, or use Copy prompt + open ChatGPT.",
      input.logoAsset
        ? `3. Ensure the official logo asset is available: ${input.logoAsset}`
        : "3. Ensure the brand text is used cleanly if no logo asset is supplied.",
      "4. Run the prompt to generate the visual.",
      "5. Save the generated file into the selected content set's _generated/vNNN folder.",
    ].join("\n");
  }

  return [
    "Action steps:",
    "1. Copy the Production prompt.",
    "2. Run it directly in ChatGPT.",
    "3. Save the output using the suggested filename if required.",
  ].join("\n");
}

export function compilePrompt(input: CompilePromptInput): CompiledPromptResult {
  const sections = parseMarkdownSections(input.contentMarkdown || "");
  const detectedSections = detectedMarkdownSectionHeadings(input.contentMarkdown || "");
  const ignoredLegacySections = ignoredLegacyOutputRuleSections(input.contentMarkdown || "");

  const intent = getSection(sections, "Intent", "Source Intent");
  const rawVisibleText = getSection(sections, "Visible Text");
  const contentHeaderText = getSection(sections, "Header Text");
  const contentFooterText = getSection(sections, "Footer Text");
  const contentLogoRules = getSection(sections, "Logo Asset", "Logo");
  const imageBrief = getSection(sections, "Image Brief");
  const coverPageContent = getSection(sections, "Cover Page Content");
  const tableOfContentsContent = getSection(sections, "Table of Contents");
  const bodyContent = getSection(sections, "Body Content", "Document Body Content", "Body");
  const linkedinPostText = getSection(sections, "LinkedIn Post Text") ||
    (input.contentType.toLowerCase() === "linkedin" ? bodyContent : "");
  const linkedInImage = isLinkedInImage(input.outputProfile);
  const visibleText = linkedInImage ? sanitizeLinkedInVisibleText(rawVisibleText) : rawVisibleText;
  const postBrief = getSection(sections, "Post Brief");
  const keyPoints = getSection(sections, "Key Points");
  const callToAction = getSection(sections, "Call To Action");
  const optionalNotes = getSection(sections, "Optional Notes");
  const contentConstraints = getSection(sections, "Content Constraints", "Constraints");
  const bodySource = bodyContent || visibleText;
  const outputTypographyRules = buildOutputTypographyRules(input.outputProfile, input.typographyRules);
  const resolvedHeaderText = resolveHeaderFooterText({
    contentValue: contentHeaderText,
    projectValue: input.projectHeaderRules,
    brandValue: input.headerRules,
    fallback: `${input.brandLabel} | ${input.projectLabel}`,
  });
  const resolvedFooterText = resolveHeaderFooterText({
    contentValue: contentFooterText,
    projectValue: input.projectFooterRules,
    brandValue: input.footerRules,
    fallback: input.projectLabel,
  });

  const dynamicLayoutPlan = solveDynamicLayout({
    contentLabel: input.contentLabel,
    contentType: input.contentType,
    outputType: input.outputProfile.outputType,
    sections,
    requestedLayoutPresetId: input.layoutPresetId,
    requestedBackgroundPresetId: input.backgroundPresetId,
    requestedDocumentBackgroundPresetId: input.documentBackgroundPresetId,
  });

  const resolvedLayoutPreset = getLayoutPreset(dynamicLayoutPlan.layoutPresetId);
  const resolvedBackgroundPreset = getBackgroundPreset(dynamicLayoutPlan.backgroundPresetId);
  const resolvedDocumentBackgroundPreset = getDocumentBackgroundPreset(
    isDocumentLike(input.outputProfile.outputType)
      ? dynamicLayoutPlan.backgroundPresetId
      : input.documentBackgroundPresetId
  );
  const resolvedBackgroundTheme = getBackgroundTheme(
    input.backgroundTheme || inferBackgroundThemeFromPreset({
      backgroundPresetId: input.backgroundPresetId,
      documentBackgroundPresetId: input.documentBackgroundPresetId,
    })
  );
  const resolvedLogo = resolvePromptLogoAsset({
    outputType: input.outputProfile.outputType,
    brandId: input.brandId,
    brandLogoAsset: input.logoAsset,
    brandLogoAssetPaths: input.brandLogoAssets,
    contentLogoRules,
    projectLogoRules: input.projectLogoRules,
    brandLogoRules: input.logoRules,
    backgroundText: [
      resolvedBackgroundTheme.id,
      resolvedBackgroundTheme.visualPrompt,
      resolvedBackgroundTheme.documentPrompt,
      resolvedBackgroundPreset.prompt,
      resolvedDocumentBackgroundPreset.prompt,
      input.visualRules,
      input.documentRules,
    ].filter(Boolean).join("\n"),
  });
  const resolvedLogoAsset = resolvedLogo.asset || input.logoAsset;
  const deckLocked = input.outputProfile.outputType === "image";

  const renderContract = buildRenderContract({
    brandLabel: input.brandLabel,
    projectLabel: input.projectLabel,
    contentLabel: input.contentLabel,
    outputLabel: getOutputLabel(input.outputProfile),
    logoAsset: resolvedLogoAsset,
    sections,
    plan: dynamicLayoutPlan,
  });

  const warnings = [...(dynamicLayoutPlan.warnings || [])];
  if (!intent) warnings.push("Missing Intent section.");
  if (input.outputProfile.outputType === "image" && !visibleText) warnings.push("Missing Visible Text section.");
  if (input.outputProfile.outputType === "image" && !imageBrief) warnings.push("Missing Image Brief section.");
  if (isDocumentLike(input.outputProfile.outputType) && !bodySource) warnings.push("Document/PDF output should include Body Content or Visible Text.");
  if (isDocumentLike(input.outputProfile.outputType) && ignoredLegacySections.length > 0) {
    warnings.push("Legacy output rules found in Markdown. These will be ignored because output rules are now injected by the prompt template.");
  }

  const contentBlocks: string[] = [];
  const expandedRuleBlocks: string[] = [];
  const compressionProfile = input.compressionProfile || "compact";
  const task = buildTask({
    outputProfile: input.outputProfile,
    contentLabel: input.contentLabel,
    brandLabel: input.brandLabel,
    projectLabel: input.projectLabel,
  });
  const context = [
    `Brand: ${input.brandLabel}`,
    `Project: ${input.projectLabel}`,
    `Content: ${input.contentLabel}`,
    `Content type: ${input.contentType}`,
    `Output: ${getOutputLabel(input.outputProfile)}`,
  ].join("\n");

  const instruction = getOutputInstruction(input.outputProfile);
  if (instruction) addBlock(expandedRuleBlocks, "Output Rule", instruction);

  const brandSummary = buildBrandSummary(input);
  if (brandSummary) addBlock(expandedRuleBlocks, "Brand System", brandSummary);

  if (resolvedLogoAsset || input.logoSourceText?.trim()) {
    addBlock(expandedRuleBlocks, "Official Logo Reference", buildLogoReferenceBlock({
      ...input,
      logoAsset: resolvedLogoAsset,
    }));
  }

  if (input.outputProfile.outputType === "image") {
    // Visual production is assembled once by buildVisualProductionPrompt below.
  } else if (isDocumentLike(input.outputProfile.outputType)) {
    // Document production is assembled once by buildDocumentProductionPrompt below.
  } else {
    const generalStyle = buildBrandDesignContract({
      outputType: input.outputProfile.outputType,
      typographyRules: input.typographyRules,
      documentRules: [input.documentRules, input.projectDocumentRules].filter(Boolean).join("\n\n"),
      tableRules: input.tableRules,
      visualRules: input.visualRules,
      headerRules: input.headerRules,
      footerRules: input.footerRules,
      logoRules: input.logoRules,
    });
    if (generalStyle) addBlock(expandedRuleBlocks, "Brand Design Contract", generalStyle);
    addBlock(contentBlocks, "Intent", intent);
    addBlock(contentBlocks, "Visible Text", visibleText);
    addBlock(contentBlocks, "Post Brief", postBrief);
    addBlock(contentBlocks, "Key Points", keyPoints);
    addBlock(contentBlocks, "Call To Action", callToAction);
    if (bodySource && isTextLike(input.outputProfile)) {
      contentBlocks.push(`Body Content:\nBEGIN BODY CONTENT\n${bodySource}\nEND BODY CONTENT`);
    }
    addBlock(contentBlocks, "Optional Notes", optionalNotes);
    addBlock(expandedRuleBlocks, "Final Rules", buildTextFinalRules());
  }

  const brandCapsule = input.outputProfile.outputType === "image" ? "" : buildBrandCapsule({
    outputType: input.outputProfile.outputType,
    brandId: input.brandId,
    brandLabel: input.brandLabel,
    projectLabel: input.projectLabel,
    logoAsset: resolvedLogoAsset,
    logoUsageNote: resolvedLogo.usageNote,
    brandRules: input.brandRules,
    projectRules: input.projectRules,
    typographyRules: input.typographyRules,
    documentRules: [input.documentRules, input.projectDocumentRules].filter(Boolean).join("\n\n"),
    tableRules: input.tableRules,
    visualRules: input.visualRules,
    headerRules: input.headerRules,
    footerRules: input.footerRules,
    resolvedHeaderText,
    resolvedFooterText,
    outputTypographyRules,
  });
  const brandColours = extractBrandColours({
    brandRules: input.brandRules,
    typographyRules: input.typographyRules,
    documentRules: input.documentRules,
    tableRules: input.tableRules,
    visualRules: input.visualRules,
  });

  const outputDirection = buildOutputDirection({
    outputProfile: input.outputProfile,
    resolvedDocumentBackgroundPreset,
    resolvedBackgroundTheme,
    projectDocumentRules: input.projectDocumentRules,
    contentConstraints,
  });

  const resolvedVisualTone = extractLabelValue(input.projectRules, "Tone") || usefulSnippet(input.visualRules, 24);
  const resolvedThemeStyle = buildShortVisualBrandStyle(input.visualRules);
  const linkedInFrame = linkedInImage ? getMasterFrameSpec(input.outputProfile.id) : undefined;

  const linkedInProductionPrompt = linkedInImage
    ? buildLinkedInProductionPrompt({
        brandName: input.brandLabel,
        projectName: input.projectLabel,
        contentTitle: input.contentLabel,
        assetFormat: getOutputLabel(input.outputProfile).replace(/^LinkedIn\s+/i, ""),
        canvas: linkedInFrame ? `${linkedInFrame.width}x${linkedInFrame.height}px` : "use the selected output profile dimensions",
        useCase: input.outputProfile.useCase || "LinkedIn campaign asset",
        workflow: compactSentence(extractLabelValue(input.projectRules, "Workflow")) || "linkedin_campaign",
        audience: compactSentence(extractLabelValue(input.projectRules, "Audience")) || `LinkedIn audiences for ${input.projectLabel}.`,
        purpose: compactSentence(extractLabelValue(input.projectRules, "Purpose")) || `Create the selected ${input.projectLabel} LinkedIn asset faithfully.`,
        tone: compactSentence(extractLabelValue(input.projectRules, "Tone")) || "Professional, clear, credible and aligned to the selected brand.",
        brandColours,
        visualTone: resolvedVisualTone || "Professional, clear and trust-building.",
        themeStyle: resolvedThemeStyle,
        layoutPresetId: resolvedLayoutPreset.id,
        backgroundPresetId: resolvedBackgroundPreset.id,
        safeMargins: input.safeMargins || input.outputProfile.safeMargins || "approximately 6% from every edge",
        intent,
        imageBrief,
        exactVisibleText: visibleText,
      })
    : "";

  const visualProductionPrompt = input.outputProfile.outputType === "image"
    ? linkedInProductionPrompt || buildVisualProductionPrompt({
        brandName: input.brandLabel,
        projectName: input.projectLabel,
        contentTitle: input.contentLabel,
        profileId: input.outputProfile.id,
        outputFormat: getOutputLabel(input.outputProfile),
        outputUseCase: input.outputProfile.useCase,
        brandColours,
        projectContext: buildProjectContext(input),
        visualTone: resolvedVisualTone,
        themeStyle: normalizeForDedup(resolvedThemeStyle) === normalizeForDedup(resolvedVisualTone) ? "" : resolvedThemeStyle,
        fontRules: outputTypographyRules,
        fontStyle: buildVisualFontStyle(input.typographyRules),
        generationMode: input.generationMode || "direct_chatgpt",
        outputInstruction: getOutputInstruction(input.outputProfile),
        headerText: resolvedHeaderText,
        footerText: resolvedFooterText,
        logoPath: resolvedLogoAsset || "",
        safeMargins: input.safeMargins || input.outputProfile.safeMargins || "approximately 4% from every edge",
        layoutPreset: resolvedLayoutPreset,
        backgroundPreset: {
          ...resolvedBackgroundPreset,
          prompt: `${backgroundModeSummary(resolvedBackgroundTheme)} ${resolvedBackgroundPreset.prompt}`,
        },
        intent,
        exactVisibleText: visibleText,
        imageBrief,
      })
    : "";

  const documentProductionPrompt = isDocumentLike(input.outputProfile.outputType)
    ? buildDocumentProductionPrompt({
        brandName: input.brandLabel,
        projectName: input.projectLabel,
        contentTitle: input.contentLabel,
        outputType: input.outputProfile.outputType as "document" | "pdf",
        pageSize: "A4",
        orientation: /landscape/i.test(getOutputLabel(input.outputProfile)) ? "landscape" : "portrait",
        documentType: resolveDocumentType(dynamicLayoutPlan.contentKind, input.contentLabel),
        backgroundTheme: resolvedBackgroundTheme.label,
        workflow: compactSentence(extractLabelValue(input.projectRules, "Workflow")) || "document_pack",
        audience: compactSentence(extractLabelValue(input.projectRules, "Audience")) || `Business readers of the ${input.projectLabel} document set.`,
        purpose: compactSentence(extractLabelValue(input.projectRules, "Purpose")) || `Create the selected ${input.projectLabel} document faithfully.`,
        tone: compactSentence(extractLabelValue(input.projectRules, "Tone")) || "Professional, clear and business appropriate.",
        brandColours,
        logoPath: resolvedLogoAsset || "official brand logo",
        headerText: resolvedHeaderText,
        footerText: resolvedFooterText,
      })
    : "";

  const compactPrompt = input.outputProfile.outputType === "image"
    ? visualProductionPrompt
    : isDocumentLike(input.outputProfile.outputType)
      ? documentProductionPrompt
    : buildCompactPrompt({
        task,
        sourceOfTruth: buildCompactSourceOfTruth(input.outputProfile),
        brandCapsule,
        outputDirection,
        contentBlocks,
      });

  const expandedPrompt = input.outputProfile.outputType === "image"
    ? visualProductionPrompt
    : isDocumentLike(input.outputProfile.outputType)
      ? documentProductionPrompt
    : buildStrictPrompt({
        modeLabel: promptModeLabel(input.outputProfile),
        task,
        context,
        outputFormat: getOutputLabel(input.outputProfile),
        sourceOfTruthRules: buildSourceOfTruthRules(input.outputProfile),
        nonNegotiableRules: expandedRuleBlocks.join("\n\n").trim() || "Use the supplied content exactly. Do not add unsupported claims.",
        contentBlocks,
        validationRules: buildValidationRules(input.outputProfile, deckLocked),
      });

  const bodyChunks = isDocumentLike(input.outputProfile.outputType)
    ? splitDocumentBodyIntoChunks(bodySource)
    : [];

  const documentAttachmentPrompt = isDocumentLike(input.outputProfile.outputType)
    ? documentProductionPrompt
    : "";

  const documentInlinePrompt = isDocumentLike(input.outputProfile.outputType)
    ? documentProductionPrompt
    : "";

  const documentRunPrompt = isDocumentLike(input.outputProfile.outputType)
    ? documentProductionPrompt
    : "";

  const productionPrompt = input.outputProfile.outputType === "image"
    ? visualProductionPrompt
    : isDocumentLike(input.outputProfile.outputType)
    ? documentAttachmentPrompt
    : compressionProfile === "expanded"
      ? expandedPrompt
      : compactPrompt;

  const promptLint = lintCompiledPrompt({
    outputProfile: input.outputProfile,
    sections,
    productionPrompt,
    plan: dynamicLayoutPlan,
    brandId: input.brandId,
    logoAsset: resolvedLogoAsset,
    logoSource: resolvedLogo.source,
    logoIsOutsideBrandAssets: resolvedLogo.isOutsideBrandAssets,
    logoSvgHasPngAlternative: resolvedLogo.svgHasPngAlternative,
    brandColours,
    contentType: input.contentType,
  });

  for (const issue of promptLint.issues) {
    if (issue.severity !== "info" && issue.code !== "image-prompt-too-long") warnings.push(issue.message);
  }

  const documentPromptParts: DocumentPromptParts = {
    runPrompt: documentRunPrompt,
    sourceMarkdown: isDocumentLike(input.outputProfile.outputType) ? input.contentMarkdown || "" : "",
    attachmentPrompt: documentAttachmentPrompt,
    instructionsPrompt: documentAttachmentPrompt,
    inlinePrompt: documentInlinePrompt,
    inlineFullPrompt: documentInlinePrompt,
    bodyContent: isDocumentLike(input.outputProfile.outputType) ? bodySource : "",
    bodyChunks,
    fullPrompt: documentAttachmentPrompt,
  };

  const debugPrompt = [
    "DEBUG PROMPT VIEW",
    `Selected Context:\nBrand: ${input.brandLabel}\nProject: ${input.projectLabel}\nContent: ${input.contentLabel}\nContent type: ${input.contentType}\nOutput: ${input.outputProfile.label}\nLogo asset: ${resolvedLogoAsset || "[None]"}\nLogo source: ${resolvedLogo.source}\nBackground theme: ${resolvedBackgroundTheme.label}`,
    `Prompt Fidelity:\nScore: ${promptLint.fidelityScore}/100\nIssues:\n${promptLint.issues.length ? promptLint.issues.map((issue) => `- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`).join("\n") : "None"}`,
    `Source Preview:\nDetected Sections:\n${detectedSections.length ? detectedSections.join(", ") : "[None]"}\n\nIgnored Legacy Sections:\n${ignoredLegacySections.length ? ignoredLegacySections.join(", ") : "[None]"}\n\nHeader Text:\n${resolvedHeaderText || "[None]"}\n\nFooter Text:\n${resolvedFooterText || "[None]"}\n\nLogo Asset:\n${resolvedLogoAsset || "[None]"}\n\nVisible Text:\n${visibleText || "[None]"}\n\nCover Page Content:\n${coverPageContent || "[None]"}\n\nTable of Contents:\n${tableOfContentsContent || "[None]"}\n\nBody Content:\n${bodySource || "[None]"}\n\nGuidance:\n${[intent, imageBrief, optionalNotes, contentConstraints].filter(Boolean).join("\n\n") || "[None]"}`,
    `Compact Production Prompt:\n${compactPrompt}`,
    `Expanded Rule Blocks:\n${expandedRuleBlocks.join("\n\n") || "[None]"}`,
    `Full Source Rules:\nBrand Rules:\n${input.brandRules || "[None]"}\n\nProject Rules:\n${input.projectRules || "[None]"}\n\nBrand Header Rules:\n${input.headerRules || "[None]"}\n\nProject Header Rules:\n${input.projectHeaderRules || "[None]"}\n\nBrand Footer Rules:\n${input.footerRules || "[None]"}\n\nProject Footer Rules:\n${input.projectFooterRules || "[None]"}\n\nBrand Logo Rules:\n${input.logoRules || "[None]"}\n\nProject Logo Rules:\n${input.projectLogoRules || "[None]"}\n\nTypography Rules:\n${input.typographyRules || "[None]"}\n\nVisual Rules:\n${input.visualRules || "[None]"}\n\nBrand Document Rules:\n${input.documentRules || "[None]"}\n\nProject Document Rules:\n${input.projectDocumentRules || "[None]"}\n\nTable Rules:\n${input.tableRules || "[None]"}`,
    `Dynamic Layout Plan:\n${JSON.stringify(dynamicLayoutPlan, null, 2)}`,
    `Render Contract:\n${JSON.stringify(renderContract, null, 2)}`,
    `Warnings:\n${warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "None"}`,
    `Raw Content Markdown:\n${input.contentMarkdown || "[None]"}`,
  ].join("\n\n");

  const actionPrompt = buildActionPrompt({
    outputProfile: input.outputProfile,
    logoAsset: resolvedLogoAsset,
  });

  const contractPrompt = renderContractToPrompt(renderContract);

  return {
    prompt: productionPrompt,
    productionPrompt,
    debugPrompt,
    actionPrompt,
    contractPrompt,
    warnings,
    promptLint,
    fidelityScore: promptLint.fidelityScore,
    promptPreview: {
      visibleText,
      linkedinPostText,
      bodyContent: isDocumentLike(input.outputProfile.outputType) ? bodySource : "",
      headerText: resolvedHeaderText,
      footerText: resolvedFooterText,
      brandColours,
      logoAsset: resolvedLogoAsset || "",
      backgroundTheme: resolvedBackgroundTheme.label,
      detectedSections,
      ignoredLegacySections,
      coverPageContent,
      tableOfContentsContent,
      guidance: [intent, imageBrief, postBrief, keyPoints, callToAction, optionalNotes, contentConstraints]
        .filter(Boolean)
        .join("\n\n"),
    },
    sections,
    dynamicLayoutPlan,
    renderContract,
    resolvedLayoutPreset,
    resolvedBackgroundPreset,
    resolvedDocumentBackgroundPreset,
    resolvedBackgroundTheme,
    documentPromptParts,
    promptStats: {
      characters: productionPrompt.length,
      words: estimateWords(productionPrompt),
      visibleTextLines: linesFromBlock(visibleText).length,
    },
  };
}
