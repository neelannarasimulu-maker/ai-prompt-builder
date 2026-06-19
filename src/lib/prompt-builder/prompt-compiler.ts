import {
  compactBlock,
  compactSentence,
  getSection,
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
import { buildDocumentGenerationContract } from "./document-output";
import { buildBrandDesignContract } from "./brand-design-contract";
import {
  buildAttachedDocumentPrompt,
  buildInlineDocumentPrompt,
  buildPastedDocumentRunPrompt,
  splitDocumentBodyIntoChunks,
  type DocumentPromptParts,
} from "./document-prompt-parts";
import { lintCompiledPrompt, type PromptLintResult } from "./prompt-lint";
import { resolvePromptLogoAsset } from "./logo-resolution";

export type OutputType = "image" | "document" | "pdf" | "text" | "email";

export type OutputProfileLike = {
  id: string;
  label: string;
  outputType: OutputType;
  format?: string;
  useCase?: string;
  instruction?: string;
  promptInstruction?: string;
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
  tableRules?: string;
  projectRules?: string;
  visualRules?: string;
  contentMarkdown: string;
  contentFilename?: string;
  layoutPresetId?: string;
  backgroundPresetId?: string;
  documentBackgroundPresetId?: string;
  backgroundTheme?: BackgroundTheme;
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
  return outputProfile.outputType === "text" || outputProfile.outputType === "email" || outputProfile.id === "linkedin_post_text";
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

function compactRuleBlock(input?: string, maxLines = 8): string {
  const source = compactBlock(input);
  if (!source) return "";
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#{1,6}\s+/.test(line));

  return lines.slice(0, maxLines).join("\n");
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

function buildVisualDeckStructureLock(input: {
  brandLabel: string;
  resolvedHeaderText: string;
  resolvedFooterText: string;
}): string {
  return [
    "Deck structure lock: 16:9 landscape, light executive canvas, approximately 4% safe margins from all edges.",
    `Fixed header zone: 8-10% of slide height. Place the official ${input.brandLabel} logo top-left with consistent size, placement and treatment across this brand/project.`,
    `Header lock: header text on the same horizontal line as the logo; use "${input.resolvedHeaderText}" in compact executive sans, approximately 8.5-10pt equivalent, never competing with the body title.`,
    "Fixed footer zone: 6-8% of slide height. Use a consistent brand-aligned footer bar or footer band with restrained accent treatment.",
    `Footer lock: use exactly "${input.resolvedFooterText}" in 8-9pt equivalent footer text, centred or evenly spaced; no footer icons, no wording changes.`,
    "Only the body area may vary. Keep body layouts on the same invisible grid with consistent margins, title hierarchy, panel style, corner radius, shadow depth, line weights and executive typography.",
    "Create meaningful variation through body layout, imagery, diagram structure, background texture, icon selection and content composition.",
    "Do not repeat the same text-left/image-right block composition across slides. Use centre-stage diagrams, orbit maps, vertical journeys, horizontal timelines, full-width hero scenes, outcome walls, signal funnels and layered architecture where the content calls for it.",
    "Use bold typographic hierarchy, coloured emphasis, highlight bands, callout pills, accent rules and contrast panels to make important exact words stand out without changing the wording.",
    "Use striking dimensional imagery, vibrant gradients, luminous brand accents and content-specific diagrams; avoid flat unstyled text blocks and generic stock-style visuals.",
    "Before finalizing, verify header, footer, logo placement, logo size, outer margins and footer wording match the deck master.",
  ].join("\n");
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
}): string {
  const brandColours = extractBrandColours(input);
  const brandBase = limitWords(
    [
      firstParagraph(input.brandRules),
      firstParagraph(input.projectRules),
    ].filter(Boolean).join(" "),
    58
  );

  const visualTone = usefulSnippet(input.visualRules, 32);
  const documentTone = usefulSnippet(input.documentRules, 32);
  const typography = usefulSnippet(input.typographyRules, 22);
  const tableRules = usefulSnippet(input.tableRules, 22);
  const logo = input.logoAsset
    ? `Logo: ${input.logoUsageNote || `use official asset ${input.logoAsset} in the header on every ${input.outputType === "image" ? "slide" : "page"}; do not redraw, recolour, stretch, replace, crop or invent a logo.`}`
    : "Logo: use clean text branding if no official asset is available.";
  const brandLine = brandBase || `Brand: ${input.brandLabel}.`;
  const colourLine = `Brand colours: ${brandColours}`;
  const deckLocked = input.outputType === "image";
  const fontLine = deckLocked
    ? "Fonts/sizes: executive sans-serif; slide title 24-34pt; body 12-18pt; header font 8.5-10pt; footer text 8-9pt."
    : "Fonts/sizes: executive sans-serif; slide title 24-34pt; body 12-18pt; header/footer small, clean and legible.";
  const deckLock = deckLocked
    ? buildVisualDeckStructureLock({
        brandLabel: input.brandLabel,
        resolvedHeaderText: input.resolvedHeaderText,
        resolvedFooterText: input.resolvedFooterText,
      })
    : "";

  if (input.outputType === "image") {
    return [
      brandLine,
      colourLine,
      visualTone ? `Visual tone: ${visualTone}` : "",
      typography ? `Typography: ${typography}` : "",
      "Theme/style: premium, brand-led, readable, executive and uncluttered.",
      fontLine,
      `Header: ${input.resolvedHeaderText}`,
      `Footer: ${input.resolvedFooterText}`,
      logo,
      deckLock,
      "Avoid: unsupported claims, fake metrics, generic dashboards, clutter, and visible text not supplied below.",
    ].filter(Boolean).join("\n");
  }

  if (input.outputType === "document" || input.outputType === "pdf") {
    return [
      brandLine,
      colourLine,
      `Header on every page: ${input.resolvedHeaderText}`,
      `Footer on every page: ${input.resolvedFooterText}`,
      documentTone ? `Document style: ${documentTone}` : "",
      "Fonts/sizes: executive sans-serif; clear A4 hierarchy; readable body text; compact header/footer.",
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
    return "Use the attached/copied Markdown source as the body source of truth. Preserve headings, paragraphs, tables, blank fields, options, checkboxes, and scoring values exactly.";
  }

  return "Use only the supplied content as source material. Do not add unsupported claims or invented facts.";
}

function outputSurfaceInstruction(outputProfile: OutputProfileLike): string {
  if (outputProfile.outputType === "image") {
    return `Create one ${getOutputLabel(outputProfile)} slide.`;
  }

  if (outputProfile.outputType === "document" || outputProfile.outputType === "pdf") {
    return `Create A4 page(s) for ${getOutputLabel(outputProfile)}.`;
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

  if (input.outputProfile.outputType === "document" || input.outputProfile.outputType === "pdf") {
    return `Create A4 page(s) titled "${input.contentLabel}" for ${input.brandLabel}. Use the ${input.projectLabel} context.`;
  }

  return `Create ${getOutputLabel(input.outputProfile)} titled "${input.contentLabel}" for ${input.brandLabel}. Use the ${input.projectLabel} context.`;
}

function buildOutputDirection(input: {
  outputProfile: OutputProfileLike;
  resolvedLayoutPreset: LayoutPreset;
  resolvedBackgroundPreset: BackgroundPreset;
  resolvedDocumentBackgroundPreset: DocumentBackgroundPreset;
  resolvedBackgroundTheme: BackgroundThemeDefinition;
  plan: DynamicLayoutPlan;
  imageBrief?: string;
  documentOutputRules?: string;
  contentConstraints?: string;
}): string {
  if (input.outputProfile.outputType === "image") {
    return [
      outputSurfaceInstruction(input.outputProfile),
      `Layout: ${input.plan.layoutPresetId}. ${limitWords(firstSentence(input.resolvedLayoutPreset.prompt), 24)}`,
      `Background theme: ${input.resolvedBackgroundTheme.label}. ${input.resolvedBackgroundTheme.visualPrompt}`,
      `Background preset refinement: ${input.plan.backgroundPresetId}. ${limitWords(firstSentence(input.resolvedBackgroundPreset.prompt), 18)}`,
      `Composition zones: ${input.plan.zones.filter((zone) => zone.name !== "header" && zone.name !== "footer").map((zone) => `${zone.name} (${zone.purpose})`).join(" | ")}`,
      input.imageBrief ? `Scene: ${limitWords(input.imageBrief, 90)}` : "",
    ].filter(Boolean).join("\n");
  }

  if (isDocumentLike(input.outputProfile.outputType)) {
    return [
      outputSurfaceInstruction(input.outputProfile),
      `Page background theme: ${input.resolvedBackgroundTheme.label}. ${input.resolvedBackgroundTheme.documentPrompt}`,
      `Document style refinement: ${limitWords(firstSentence(input.resolvedDocumentBackgroundPreset.prompt), 28)}`,
      input.documentOutputRules ? `Output rules: ${limitWords(input.documentOutputRules, 44)}` : "",
      input.contentConstraints ? `Constraints: ${limitWords(input.contentConstraints, 32)}` : "",
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

function buildVisualStyleContract(input: CompilePromptInput, resolvedLayoutPreset: LayoutPreset, resolvedBackgroundPreset: BackgroundPreset, plan: DynamicLayoutPlan): string {
  const parts: string[] = [];

  const visualHeader = compactRuleBlock(
    filterLinesContaining(input.headerRules, [
      "word", "pdf", "page number", "page numbers", "on every page", "document", "docx"
    ]),
    4
  );
  const visualFooter = compactRuleBlock(
    filterLinesContaining(input.footerRules, [
      "word", "pdf", "page number", "page numbers", "on every page", "document", "docx"
    ]),
    4
  );
  const visualTypography = compactRuleBlock(
    filterLinesContaining(input.typographyRules, [
      "document typography", "word", "pdf", "page number", "document"
    ]),
    6
  );
  const visualDesign = compactRuleBlock(
    filterLinesContaining(input.visualRules, [
      "word", "pdf", "page number", "page numbers", "document body", "body content", "docx"
    ]),
    12
  );
  const logoHandling = compactRuleBlock(
    filterLinesContaining(input.logoRules, [
      "prompt-builder note", "base64", "word", "pdf", "document"
    ]),
    8
  );

  if (visualHeader) parts.push(`Header rules:
${visualHeader}`);
  if (visualFooter) parts.push(`Footer rules:
${visualFooter}`);
  if (logoHandling) parts.push(`Logo rules:
${logoHandling}`);
  if (visualTypography) parts.push(`Visual typography rules:
${visualTypography}`);
  if (visualDesign) parts.push(`Visual design rules:
${visualDesign}`);

  parts.push([
    `Layout: ${plan.layoutPresetId} - ${resolvedLayoutPreset.prompt}`,
    `Background: ${plan.backgroundPresetId} - ${resolvedBackgroundPreset.prompt}`,
    `Text placement: ${plan.textPlacement}`,
    `Image placement: ${plan.imagePlacement}`,
    `Font strategy: ${plan.fontStrategy}`,
  ].join("\n"));

  return parts.join("\n\n").trim();
}

function buildVisualFinalRules(hasLogo: boolean, deckLocked = false): string {
  return dedupeLines([
    "Use only the Visible Text as on-image text.",
    "Use Intent, Layout Hint, Background Hint and Image Brief as guidance only.",
    "Do not add, remove, rewrite or reorder the supplied visible wording.",
    "You may style exact visible words with bold weight, larger scale, colour, highlight bands, callout pills or accent rules, but the wording must remain exact.",
    "Preserve numeric values, labels, bullets and grouping exactly as supplied.",
    "Use the brand, header, footer, typography and style rules as rendering guidance only, not as visible content.",
    "Create a finished image only. Do not include document-generation instructions in the output.",
    hasLogo ? "Use the supplied official logo asset where supported." : "Use clean text branding if no logo asset is supplied.",
    "Do not invent a replacement logo.",
    deckLocked ? "Vary only the body area; never vary header structure, footer structure, logo placement, logo size, outer frame or master margins." : "",
    deckLocked ? "Avoid repeating a generic left text panel plus right image panel unless that exact layout is requested. Choose a content-specific composition from the layout plan." : "",
    deckLocked ? "Before finalizing, verify fixed header, footer, logo placement, outer margins and footer wording match the deck master." : "",
    "Use striking dimensional imagery, vibrant gradients, luminous brand accents and content-specific diagrams where appropriate.",
    "Avoid unsupported claims, fake metrics, fake dashboards, generic stock-style visuals and flat unstyled text blocks.",
  ]).map((line) => `- ${line}`).join("\n");
}

function buildDocumentFinalRules(): string {
  return dedupeLines([
    "Create the requested document immediately from the supplied Markdown source.",
    "Use ## Body Content as the exact document body source of truth.",
    "Do not summarise, shorten, reorder, rename, remove or add content.",
    "Render Markdown pipe tables as real formatted Word/PDF tables.",
    "Preserve blank cells as blank fields for completion.",
    "Use the supplied brand header, footer, logo and table styling rules.",
    "Use repeated headers, repeated footers and dynamic page numbering where the output format supports it.",
    "Keep the result premium, readable and print-ready.",
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
      "The document body source of truth is the ## Body Content section inside the delimited source Markdown.",
      "If Body Content is absent, use Visible Text as the fallback body source.",
      "Brand, layout, header, footer, and table rules are formatting guidance only.",
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
      "Verify that Markdown pipe tables are rendered as formatted document tables.",
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
      "2. Attach the source Markdown file if you want ChatGPT to read the file directly, or paste the run-ready prompt as-is.",
      "3. Run the prompt. It already tells ChatGPT to create the requested document immediately.",
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
      "5. Save the generated file into the selected project's generated-content folder.",
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

  const intent = getSection(sections, "Intent", "Source Intent");
  const visibleText = getSection(sections, "Visible Text");
  const contentHeaderText = getSection(sections, "Header Text");
  const contentFooterText = getSection(sections, "Footer Text");
  const contentLogoRules = getSection(sections, "Logo Asset", "Logo");
  const imageBrief = getSection(sections, "Image Brief");
  const bodyContent = getSection(sections, "Body Content", "Document Body Content", "Body");
  const postBrief = getSection(sections, "Post Brief");
  const keyPoints = getSection(sections, "Key Points");
  const callToAction = getSection(sections, "Call To Action");
  const optionalNotes = getSection(sections, "Optional Notes");
  const contentConstraints = getSection(sections, "Content Constraints", "Constraints");
  const documentOutputRules = getSection(sections, "Document Output Rules", "Output Rules");
  const bodySource = bodyContent || visibleText;
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
  });

  const resolvedLayoutPreset = getLayoutPreset(dynamicLayoutPlan.layoutPresetId);
  const resolvedBackgroundPreset = getBackgroundPreset(dynamicLayoutPlan.backgroundPresetId);
  const resolvedDocumentBackgroundPreset = getDocumentBackgroundPreset(input.documentBackgroundPresetId);
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

  const warnings: string[] = [];
  if (!intent) warnings.push("Missing Intent section.");
  if (input.outputProfile.outputType === "image" && !visibleText) warnings.push("Missing Visible Text section.");
  if (input.outputProfile.outputType === "image" && !imageBrief) warnings.push("Missing Image Brief section.");
  if (isDocumentLike(input.outputProfile.outputType) && !bodySource) warnings.push("Document/PDF output should include Body Content or Visible Text.");

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
    if (deckLocked) {
      addBlock(expandedRuleBlocks, "Deck Structure Lock", buildVisualDeckStructureLock({
        brandLabel: input.brandLabel,
        resolvedHeaderText,
        resolvedFooterText,
      }));
    }
    addBlock(expandedRuleBlocks, "Visual Style Contract", buildVisualStyleContract(input, resolvedLayoutPreset, resolvedBackgroundPreset, dynamicLayoutPlan));
    addBlock(contentBlocks, "Intent", intent);
    if (visibleText) {
      contentBlocks.push(`Exact Visible Text:\nBEGIN EXACT VISIBLE TEXT\n${linesFromBlock(visibleText).join("\n")}\nEND EXACT VISIBLE TEXT`);
    }
    addBlock(contentBlocks, "Optional Notes", optionalNotes);
    addBlock(expandedRuleBlocks, "Final Rules", buildVisualFinalRules(Boolean(resolvedLogoAsset || input.logoSourceText?.trim()), deckLocked));
  } else if (isDocumentLike(input.outputProfile.outputType)) {
    addBlock(expandedRuleBlocks, "Document Generation Contract", buildDocumentGenerationContract({
      sections,
      brandLabel: input.brandLabel,
      projectLabel: input.projectLabel,
      contentLabel: input.contentLabel,
      outputLabel: getOutputLabel(input.outputProfile),
      logoAsset: resolvedLogoAsset,
      headerRules: [input.headerRules, input.projectHeaderRules, resolvedHeaderText ? `Resolved header text: ${resolvedHeaderText}` : ""].filter(Boolean).join("\n\n"),
      footerRules: [input.footerRules, input.projectFooterRules, resolvedFooterText ? `Resolved footer text: ${resolvedFooterText}` : ""].filter(Boolean).join("\n\n"),
      logoRules: input.logoRules,
      typographyRules: input.typographyRules,
      documentRules: input.documentRules,
      tableRules: input.tableRules,
      documentBackgroundPrompt: resolvedDocumentBackgroundPreset.prompt,
    }));
    addBlock(contentBlocks, "Intent", intent);
    addBlock(contentBlocks, "Optional Notes", optionalNotes);
    addBlock(expandedRuleBlocks, "Final Rules", buildDocumentFinalRules());
  } else {
    const generalStyle = buildBrandDesignContract({
      outputType: input.outputProfile.outputType,
      typographyRules: input.typographyRules,
      documentRules: input.documentRules,
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

  const brandCapsule = buildBrandCapsule({
    outputType: input.outputProfile.outputType,
    brandId: input.brandId,
    brandLabel: input.brandLabel,
    projectLabel: input.projectLabel,
    logoAsset: resolvedLogoAsset,
    logoUsageNote: resolvedLogo.usageNote,
    brandRules: input.brandRules,
    projectRules: input.projectRules,
    typographyRules: input.typographyRules,
    documentRules: input.documentRules,
    tableRules: input.tableRules,
    visualRules: input.visualRules,
    headerRules: input.headerRules,
    footerRules: input.footerRules,
    resolvedHeaderText,
    resolvedFooterText,
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
    resolvedLayoutPreset,
    resolvedBackgroundPreset,
    resolvedDocumentBackgroundPreset,
    resolvedBackgroundTheme,
    plan: dynamicLayoutPlan,
    imageBrief,
    documentOutputRules,
    contentConstraints,
  });

  const compactPrompt = buildCompactPrompt({
    task,
    sourceOfTruth: buildCompactSourceOfTruth(input.outputProfile),
    brandCapsule,
    outputDirection,
    contentBlocks,
  });

  const expandedPrompt = buildStrictPrompt({
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
    ? buildAttachedDocumentPrompt({
        taskAndRules: compactPrompt,
        sourceFilename: input.contentFilename,
        expectedBodySection: "## Body Content",
      })
    : "";

  const documentInlinePrompt = isDocumentLike(input.outputProfile.outputType)
    ? buildInlineDocumentPrompt({
        taskAndRules: compactPrompt,
        bodyContent: bodySource,
      })
    : "";

  const documentRunPrompt = isDocumentLike(input.outputProfile.outputType)
    ? buildPastedDocumentRunPrompt({
        taskAndRules: compactPrompt,
        sourceMarkdown: input.contentMarkdown || "",
        sourceFilename: input.contentFilename,
        logoAsset: resolvedLogoAsset,
        logoSourceText: shouldEmbedLogoSource(input.logoSourceText) ? input.logoSourceText : "",
      })
    : "";

  const productionPrompt =
    compressionProfile === "expanded"
      ? expandedPrompt
      : compressionProfile === "singleMessageDocument" && isDocumentLike(input.outputProfile.outputType)
        ? documentRunPrompt
        : isDocumentLike(input.outputProfile.outputType)
          ? documentAttachmentPrompt
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
    fullPrompt: productionPrompt,
  };

  const debugPrompt = [
    "DEBUG PROMPT VIEW",
    `Selected Context:\nBrand: ${input.brandLabel}\nProject: ${input.projectLabel}\nContent: ${input.contentLabel}\nContent type: ${input.contentType}\nOutput: ${input.outputProfile.label}\nLogo asset: ${resolvedLogoAsset || "[None]"}\nLogo source: ${resolvedLogo.source}\nBackground theme: ${resolvedBackgroundTheme.label}`,
    `Prompt Fidelity:\nScore: ${promptLint.fidelityScore}/100\nIssues:\n${promptLint.issues.length ? promptLint.issues.map((issue) => `- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`).join("\n") : "None"}`,
    `Source Preview:\nHeader Text:\n${resolvedHeaderText || "[None]"}\n\nFooter Text:\n${resolvedFooterText || "[None]"}\n\nLogo Asset:\n${resolvedLogoAsset || "[None]"}\n\nVisible Text:\n${visibleText || "[None]"}\n\nBody Content:\n${bodySource || "[None]"}\n\nGuidance:\n${[intent, imageBrief, optionalNotes, contentConstraints].filter(Boolean).join("\n\n") || "[None]"}`,
    `Compact Production Prompt:\n${compactPrompt}`,
    `Expanded Rule Blocks:\n${expandedRuleBlocks.join("\n\n") || "[None]"}`,
    `Full Source Rules:\nBrand Rules:\n${input.brandRules || "[None]"}\n\nProject Rules:\n${input.projectRules || "[None]"}\n\nBrand Header Rules:\n${input.headerRules || "[None]"}\n\nProject Header Rules:\n${input.projectHeaderRules || "[None]"}\n\nBrand Footer Rules:\n${input.footerRules || "[None]"}\n\nProject Footer Rules:\n${input.projectFooterRules || "[None]"}\n\nBrand Logo Rules:\n${input.logoRules || "[None]"}\n\nProject Logo Rules:\n${input.projectLogoRules || "[None]"}\n\nTypography Rules:\n${input.typographyRules || "[None]"}\n\nVisual Rules:\n${input.visualRules || "[None]"}\n\nDocument Rules:\n${input.documentRules || "[None]"}\n\nTable Rules:\n${input.tableRules || "[None]"}`,
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
      bodyContent: isDocumentLike(input.outputProfile.outputType) ? bodySource : "",
      headerText: resolvedHeaderText,
      footerText: resolvedFooterText,
      brandColours,
      logoAsset: resolvedLogoAsset || "",
      backgroundTheme: resolvedBackgroundTheme.label,
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
