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

export type CompilePromptInput = {
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  contentType: string;
  outputProfile: OutputProfileLike;
  logoAsset?: string;
  logoSourceText?: string;
  brandRules?: string;
  headerRules?: string;
  footerRules?: string;
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
};

export type CompiledPromptResult = {
  prompt: string;
  productionPrompt: string;
  debugPrompt: string;
  actionPrompt: string;
  contractPrompt: string;
  warnings: string[];
  sections: ParsedSections;
  dynamicLayoutPlan: DynamicLayoutPlan;
  renderContract: RenderContract;
  resolvedLayoutPreset: LayoutPreset;
  resolvedBackgroundPreset: BackgroundPreset;
  resolvedDocumentBackgroundPreset: DocumentBackgroundPreset;
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

function buildVisualFinalRules(hasLogo: boolean): string {
  return dedupeLines([
    "Use only the Visible Text as on-image text.",
    "Use Intent, Layout Hint, Background Hint and Image Brief as guidance only.",
    "Do not add, remove, rewrite or reorder the supplied visible wording.",
    "Preserve numeric values, labels, bullets and grouping exactly as supplied.",
    "Use the brand, header, footer, typography and style rules as rendering guidance only, not as visible content.",
    "Create a finished image only. Do not include document-generation instructions in the output.",
    hasLogo ? "Use the supplied official logo asset where supported." : "Use clean text branding if no logo asset is supplied.",
    "Do not invent a replacement logo.",
    "Avoid unsupported claims, fake metrics, fake dashboards and generic stock-style visuals.",
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
  const imageBrief = getSection(sections, "Image Brief");
  const bodyContent = getSection(sections, "Body Content", "Document Body Content", "Body");
  const postBrief = getSection(sections, "Post Brief");
  const keyPoints = getSection(sections, "Key Points");
  const callToAction = getSection(sections, "Call To Action");
  const optionalNotes = getSection(sections, "Optional Notes");
  const contentConstraints = getSection(sections, "Content Constraints", "Constraints");
  const documentOutputRules = getSection(sections, "Document Output Rules", "Output Rules");
  const bodySource = bodyContent || visibleText;

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

  const renderContract = buildRenderContract({
    brandLabel: input.brandLabel,
    projectLabel: input.projectLabel,
    contentLabel: input.contentLabel,
    outputLabel: getOutputLabel(input.outputProfile),
    logoAsset: input.logoAsset,
    sections,
    plan: dynamicLayoutPlan,
  });

  const warnings = [...(dynamicLayoutPlan.warnings || [])];
  if (!intent) warnings.push("Missing Intent section.");
  if (input.outputProfile.outputType === "image" && !visibleText) warnings.push("Missing Visible Text section.");
  if (input.outputProfile.outputType === "image" && !imageBrief) warnings.push("Missing Image Brief section.");
  if (isDocumentLike(input.outputProfile.outputType) && !bodySource) warnings.push("Document/PDF output should include Body Content or Visible Text.");

  const blocks: string[] = [];
  blocks.push(`Task:\nCreate the requested output for ${input.brandLabel}. Use the ${input.projectLabel} context. Do not add unsupported claims.`);
  blocks.push(`Context:\nBrand: ${input.brandLabel}\nProject: ${input.projectLabel}\nContent: ${input.contentLabel}\nContent type: ${input.contentType}\nOutput: ${getOutputLabel(input.outputProfile)}`);

  const instruction = getOutputInstruction(input.outputProfile);
  if (instruction) addBlock(blocks, "Output Rule", instruction);

  const brandSummary = buildBrandSummary(input);
  if (brandSummary) addBlock(blocks, "Brand System", brandSummary);

  if (input.logoAsset || input.logoSourceText?.trim()) {
    addBlock(blocks, "Official Logo Reference", buildLogoReferenceBlock(input));
  }

  if (input.outputProfile.outputType === "image") {
    addBlock(blocks, "Visual Style Contract", buildVisualStyleContract(input, resolvedLayoutPreset, resolvedBackgroundPreset, dynamicLayoutPlan));
    addBlock(blocks, "Intent", intent);
    if (visibleText) blocks.push(`Visible Text:\n${linesFromBlock(visibleText).join("\n")}`);
    addBlock(blocks, "Image Brief", imageBrief);
    addBlock(blocks, "Optional Notes", optionalNotes);
    addBlock(blocks, "Content Constraints", contentConstraints);
    addBlock(blocks, "Final Rules", buildVisualFinalRules(Boolean(input.logoAsset || input.logoSourceText?.trim())));
  } else if (isDocumentLike(input.outputProfile.outputType)) {
    addBlock(blocks, "Document Generation Contract", buildDocumentGenerationContract({
      sections,
      brandLabel: input.brandLabel,
      projectLabel: input.projectLabel,
      contentLabel: input.contentLabel,
      outputLabel: getOutputLabel(input.outputProfile),
      logoAsset: input.logoAsset,
      headerRules: input.headerRules,
      footerRules: input.footerRules,
      logoRules: input.logoRules,
      typographyRules: input.typographyRules,
      documentRules: input.documentRules,
      tableRules: input.tableRules,
      documentBackgroundPrompt: resolvedDocumentBackgroundPreset.prompt,
    }));
    addBlock(blocks, "Intent", intent);
    addBlock(blocks, "Document Output Rules", documentOutputRules);
    addBlock(blocks, "Optional Notes", optionalNotes);
    addBlock(blocks, "Content Constraints", contentConstraints);
    addBlock(blocks, "Final Rules", buildDocumentFinalRules());
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
    if (generalStyle) addBlock(blocks, "Brand Design Contract", generalStyle);
    addBlock(blocks, "Intent", intent);
    addBlock(blocks, "Visible Text", visibleText);
    addBlock(blocks, "Post Brief", postBrief);
    addBlock(blocks, "Key Points", keyPoints);
    addBlock(blocks, "Call To Action", callToAction);
    if (bodySource && isTextLike(input.outputProfile)) {
      blocks.push(`Body Content:\nBEGIN BODY CONTENT\n${bodySource}\nEND BODY CONTENT`);
    }
    addBlock(blocks, "Optional Notes", optionalNotes);
    addBlock(blocks, "Content Constraints", contentConstraints);
    addBlock(blocks, "Final Rules", buildTextFinalRules());
  }

  const basePromptWithoutBody = blocks.join("\n\n").trim();

  const bodyChunks = isDocumentLike(input.outputProfile.outputType)
    ? splitDocumentBodyIntoChunks(bodySource)
    : [];

  const documentAttachmentPrompt = isDocumentLike(input.outputProfile.outputType)
    ? buildAttachedDocumentPrompt({
        taskAndRules: basePromptWithoutBody,
        sourceFilename: input.contentFilename,
        expectedBodySection: "## Body Content",
      })
    : "";

  const documentInlinePrompt = isDocumentLike(input.outputProfile.outputType)
    ? buildInlineDocumentPrompt({
        taskAndRules: basePromptWithoutBody,
        bodyContent: bodySource,
      })
    : "";

  const documentRunPrompt = isDocumentLike(input.outputProfile.outputType)
    ? buildPastedDocumentRunPrompt({
        taskAndRules: basePromptWithoutBody,
        sourceMarkdown: input.contentMarkdown || "",
        sourceFilename: input.contentFilename,
        logoAsset: input.logoAsset,
        logoSourceText: shouldEmbedLogoSource(input.logoSourceText) ? input.logoSourceText : "",
      })
    : "";

  const productionPrompt = isDocumentLike(input.outputProfile.outputType)
    ? documentRunPrompt
    : basePromptWithoutBody;

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
    `Selected Context:\nBrand: ${input.brandLabel}\nProject: ${input.projectLabel}\nContent: ${input.contentLabel}\nContent type: ${input.contentType}\nOutput: ${input.outputProfile.label}\nLogo asset: ${input.logoAsset || "[None]"}`,
    `Dynamic Layout Plan:\n${JSON.stringify(dynamicLayoutPlan, null, 2)}`,
    `Render Contract:\n${JSON.stringify(renderContract, null, 2)}`,
    `Warnings:\n${warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "None"}`,
  ].join("\n\n");

  const actionPrompt = buildActionPrompt({
    outputProfile: input.outputProfile,
    logoAsset: input.logoAsset,
  });

  const contractPrompt = renderContractToPrompt(renderContract);

  return {
    prompt: productionPrompt,
    productionPrompt,
    debugPrompt,
    actionPrompt,
    contractPrompt,
    warnings,
    sections,
    dynamicLayoutPlan,
    renderContract,
    resolvedLayoutPreset,
    resolvedBackgroundPreset,
    resolvedDocumentBackgroundPreset,
    documentPromptParts,
    promptStats: {
      characters: productionPrompt.length,
      words: estimateWords(productionPrompt),
      visibleTextLines: linesFromBlock(visibleText).length,
    },
  };
}
