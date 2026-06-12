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

function getOutputLabel(outputProfile: OutputProfileLike): string {
  return outputProfile.format || outputProfile.label || outputProfile.id;
}

function getOutputInstruction(outputProfile: OutputProfileLike): string {
  return outputProfile.instruction || outputProfile.promptInstruction || "";
}

function normalizeForDedup(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9|:#.%()\- ]+/g, "")
    .trim();
}

function pushSection(bucket: string[], label: string, value?: string): void {
  const cleaned = compactBlock(value);
  if (!cleaned) return;

  const candidate = `${label}:\n${cleaned}`;
  const normalized = normalizeForDedup(candidate);

  if (!bucket.some((item) => normalizeForDedup(item) === normalized)) {
    bucket.push(candidate);
  }
}

function dedupeRules(rules: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const rule of rules) {
    const normalized = normalizeForDedup(rule);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(rule);
  }

  return output;
}

function isDocumentLike(outputType: OutputType): boolean {
  return outputType === "document" || outputType === "pdf";
}

function isTextLike(outputProfile: OutputProfileLike): boolean {
  return outputProfile.outputType === "text" || outputProfile.outputType === "email" || outputProfile.id === "linkedin_post_text";
}

function buildActionPrompt(input: {
  outputProfile: OutputProfileLike;
  logoAsset?: string;
}): string {
  const lines: string[] = [];

  lines.push("Action steps:");

  if (isDocumentLike(input.outputProfile.outputType)) {
    lines.push("1. Copy the Production prompt. It already includes the selected Markdown document source pasted inline.");
    lines.push("2. Open ChatGPT and paste the Production prompt.");
    lines.push("3. Run the prompt. It instructs ChatGPT to create the Word/PDF document immediately, without a separate CREATE DOCUMENT message.");
    if (input.logoAsset) {
      lines.push(`4. Use the official logo where supported: ${input.logoAsset}. If the logo is not available, use the brand header text.`);
    } else {
      lines.push("4. Use the brand header text if no logo asset is available.");
    }
    lines.push("5. Download the generated document and save it using the suggested output filename.");
    return lines.join("\n");
  }

  lines.push("1. Review the Dynamic Analysis warnings.");
  lines.push("2. When Visible Text changes, click Update dynamic tags so Intent, Layout Hint, Background Hint and Image Brief stay aligned.");
  lines.push("3. Copy the Production prompt or Contract prompt.");
  if (input.logoAsset && input.outputProfile.outputType !== "text" && input.outputProfile.outputType !== "email") {
    lines.push(`4. Attach/render the official logo asset: ${input.logoAsset}`);
  } else {
    lines.push("4. No logo attachment is required for this output.");
  }
  lines.push("5. Save the generated file into the selected project's generated-content folder and refresh preview.");

  return lines.join("\n");
}

function removeOutputSpecificSentences(input: string | undefined, outputType: OutputType): string {
  const source = compactSentence(input);
  if (!source) return "";

  const forbidden = outputType === "image"
    ? ["word", "pdf", "docx", "page number", "page numbers", "document body", "body content", "fillable tables", "a4 word"]
    : outputType === "document" || outputType === "pdf"
      ? ["on-image", "image output", "visual output", "slide background", "fake dashboards"]
      : [];

  if (forbidden.length === 0) return source;

  return source
    .split(/(?<=[.!?])\s+/g)
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return !forbidden.some((term) => lower.includes(term));
    })
    .join(" ")
    .trim();
}

function buildBrandBlock(input: CompilePromptInput): string {
  return [
    removeOutputSpecificSentences(input.brandRules, input.outputProfile.outputType),
    removeOutputSpecificSentences(input.projectRules, input.outputProfile.outputType),
    input.logoAsset ? `Logo asset: ${input.logoAsset}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function shouldEmbedLogoSource(logoSourceText?: string): boolean {
  const source = logoSourceText?.trim();
  if (!source) return false;
  if (source.length > 16000) return false;
  if (/data:image\/(png|jpe?g|webp);base64/i.test(source)) return false;
  return true;
}

function buildLogoReferenceBlock(input: CompilePromptInput): string {
  if (shouldEmbedLogoSource(input.logoSourceText)) {
    return [
      input.logoAsset ? `Logo asset path: ${input.logoAsset}` : "Logo asset path: [not supplied]",
      "Use the official logo source below where supported. Do not recreate, recolour, stretch or distort it.",
      "BEGIN LOGO SVG",
      input.logoSourceText?.trim() || "",
      "END LOGO SVG",
    ].join("\n");
  }

  return [
    input.logoAsset ? `Logo asset path: ${input.logoAsset}` : "Logo asset path: [not supplied]",
    "Use the attached official logo where available. If no logo file is attached or the renderer cannot use it, reserve clean brand-header space and use the brand text. Do not invent or redraw the logo.",
  ].join("\n");
}

function buildVisualLogoBlock(input: CompilePromptInput): string {
  return [
    input.logoRules ? `Logo rules: ${compactSentence(input.logoRules)}` : "",
    input.logoAsset ? `Logo asset: ${input.logoAsset}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildZoneBlock(plan: DynamicLayoutPlan): string {
  const zones = Array.isArray(plan.zones) ? plan.zones : [];
  return zones
    .map(
      (zone) =>
        `${zone.name}: x ${zone.x}%, y ${zone.y}%, w ${zone.width}%, h ${zone.height}% - ${zone.purpose}`
    )
    .join("\n");
}

export function compilePrompt(input: CompilePromptInput): CompiledPromptResult {
  const sections = parseMarkdownSections(input.contentMarkdown || "");

  const intent = getSection(sections, "Intent", "Source Intent");
  const visibleText = getSection(sections, "Visible Text");
  const imageBrief = getSection(sections, "Image Brief");
  const bodyContent = getSection(sections, "Body Content");
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
  const resolvedDocumentBackgroundPreset = getDocumentBackgroundPreset(
    input.documentBackgroundPresetId
  );

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
  if (!visibleText && input.outputProfile.outputType === "image") {
    warnings.push("Missing Visible Text section.");
  }
  if (input.outputProfile.outputType === "image" && !imageBrief) {
    warnings.push("Missing Image Brief section. Click Update dynamic tags to generate it from Visible Text.");
  }
  if (isDocumentLike(input.outputProfile.outputType) && !bodySource) {
    warnings.push("Document/PDF output should include Body Content or Visible Text.");
  }

  const blocks: string[] = [];

  blocks.push(
    `Task:\nCreate the requested output for ${input.brandLabel}. Use the ${input.projectLabel} context. Do not add unsupported claims.`
  );

  blocks.push(
    `Context:\nBrand: ${input.brandLabel}\nProject: ${input.projectLabel}\nContent: ${input.contentLabel}\nContent type: ${input.contentType}\nOutput: ${getOutputLabel(input.outputProfile)}`
  );

  const instruction = getOutputInstruction(input.outputProfile);
  if (instruction) {
    pushSection(blocks, "Output Rule", compactSentence(instruction));
  }

  pushSection(blocks, "Brand + Project", buildBrandBlock(input));

  pushSection(
    blocks,
    "Brand Design Contract",
    buildBrandDesignContract({
      outputType: input.outputProfile.outputType,
      typographyRules: input.typographyRules,
      documentRules: input.documentRules,
      tableRules: input.tableRules,
      visualRules: input.visualRules,
      headerRules: input.headerRules,
      footerRules: input.footerRules,
      logoRules: input.logoRules,
    })
  );

  if (input.logoAsset || input.logoSourceText?.trim()) {
    pushSection(blocks, "Official Logo Reference", buildLogoReferenceBlock(input));
  }

  if (input.outputProfile.outputType === "image") {
    const semantic = dynamicLayoutPlan.semantic;
    pushSection(blocks, "Visual Logo Rules", buildVisualLogoBlock(input));
    pushSection(
      blocks,
      "Visual Source Rules",
      [
        "Use ## Visible Text as the only on-image text source.",
        "Use Intent, Layout Hint, Background Hint and Image Brief as rendering guidance only.",
        "Do not include ## Body Content in the visual unless the same wording also appears in ## Visible Text.",
        "Keep the output as a visual/image only. Do not include document-production instructions in the visual output.",
      ].join("\n")
    );

    pushSection(
      blocks,
      "Dynamic Layout Plan",
      [
        `Detected content kind: ${dynamicLayoutPlan.contentKind || "general"}`,
        `Semantic pattern: ${semantic?.pattern || "none"}`,
        `Semantic items: ${semantic?.itemCount ?? 0}`,
        `Semantic fields: ${semantic?.fieldNames?.join(", ") || "none"}`,
        `Text density: ${dynamicLayoutPlan.density?.level || "unknown"} (${dynamicLayoutPlan.density?.lineCount ?? 0} lines, ${dynamicLayoutPlan.density?.wordCount ?? 0} words)`,
        `Layout: ${dynamicLayoutPlan.layoutPresetId} - ${resolvedLayoutPreset.prompt}`,
        `Background: ${dynamicLayoutPlan.backgroundPresetId} - ${resolvedBackgroundPreset.prompt}`,
        `Text placement: ${dynamicLayoutPlan.textPlacement}`,
        `Image placement: ${dynamicLayoutPlan.imagePlacement}`,
        `Font strategy: ${dynamicLayoutPlan.fontStrategy}`,
        `Zones:\n${buildZoneBlock(dynamicLayoutPlan)}`,
        `Semantic Visible Text Summary:\n${dynamicLayoutPlan.semanticSummary || "No semantic summary available."}`,
      ].join("\n")
    );
  }

  if (isDocumentLike(input.outputProfile.outputType)) {
    pushSection(
      blocks,
      "Document Generation Contract",
      buildDocumentGenerationContract({
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
      })
    );
  }

  if (input.outputProfile.outputType !== "image" && !isDocumentLike(input.outputProfile.outputType)) {
    pushSection(blocks, "Output Style", input.visualRules);
  }

  pushSection(blocks, "Intent", intent);

  if (visibleText && input.outputProfile.outputType === "image") {
    blocks.push(`Visible Text:\n${linesFromBlock(visibleText).join("\n")}`);
  } else if (visibleText && !isDocumentLike(input.outputProfile.outputType)) {
    pushSection(blocks, "Visible Text", visibleText);
  }

  if (input.outputProfile.outputType === "image") {
    pushSection(blocks, "Image Brief", imageBrief);
  }

  if (isDocumentLike(input.outputProfile.outputType)) {
    pushSection(blocks, "Document Output Rules", documentOutputRules);
  }

  if (isTextLike(input.outputProfile)) {
    pushSection(blocks, "Post Brief", postBrief);
    pushSection(blocks, "Key Points", keyPoints);
    pushSection(blocks, "Call To Action", callToAction);
    if (bodySource) {
      blocks.push(`Body Content:\nBEGIN BODY CONTENT\n${bodySource}\nEND BODY CONTENT`);
    }
  }

  pushSection(blocks, "Optional Notes", optionalNotes);
  pushSection(blocks, "Content Constraints", contentConstraints);

  const finalRules: string[] = [];

  if (input.outputProfile.outputType === "image") {
    finalRules.push("Use only the Visible Text as on-image text.");
    finalRules.push("Do not add or rewrite claims.");
    finalRules.push("Use semantic fields to infer structure, but preserve the supplied values exactly.");
    finalRules.push("Keep each Title with its matching Body, Status, Remaining, Option, Phase, Timeline, Date, Lane or Item fields.");
    finalRules.push("Design around the specified zones before placing text.");
    finalRules.push("Do not place important artwork behind text, header or footer zones.");
    finalRules.push("Use the selected brand colours, gradients and visual rules.");
    finalRules.push("Use the supplied official logo asset where supported.");
    finalRules.push("Do not invent a replacement logo.");
    finalRules.push("Avoid fake dashboards, fake metrics and generic stock-style visuals.");
  }

  if (isDocumentLike(input.outputProfile.outputType)) {
    finalRules.push("Use a professional A4 document structure.");
    finalRules.push("Use Body Content as the exact document source of truth.");
    finalRules.push("Do not summarise, shorten, reorder, rename, remove or add content.");
    finalRules.push("Render Markdown pipe tables as proper Word/PDF tables.");
    finalRules.push("Do not use HTML table tags unless they already exist in the source.");
    finalRules.push("Use the selected brand header with logo and header text.");
    finalRules.push("Use a repeated footer with document name and dynamic page numbers.");
    finalRules.push("Preserve empty table cells as blank fields for completion.");
    finalRules.push("Keep the result premium, readable and print-ready.");
  }

  if (input.outputProfile.outputType === "text" || input.outputProfile.outputType === "email") {
    finalRules.push("Keep the result clear, concise and aligned to the supplied content.");
    finalRules.push("Do not add unsupported claims.");
  }

  pushSection(blocks, "Final Rules", `- ${dedupeRules(finalRules).join("\n- ")}`);

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
