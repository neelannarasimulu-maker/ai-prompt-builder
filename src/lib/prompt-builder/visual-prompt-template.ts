import type { BackgroundPreset } from "./background-presets";
import type { LayoutPreset } from "./layout-presets";
import { buildBodyArtworkInstruction, getMasterFrameSpec } from "./master-frame";

export type VisualGenerationMode = "direct_chatgpt" | "app_composited";

export type VisualPromptTemplateInput = {
  brandName: string;
  projectName: string;
  contentTitle: string;
  profileId: string;
  outputFormat: string;
  outputUseCase?: string;
  brandColours: string;
  projectContext: string;
  visualTone: string;
  themeStyle: string;
  fontRules: string;
  fontStyle?: string;
  titleSizeRange?: string;
  sectionHeadingSizeRange?: string;
  bodySizeRange?: string;
  smallLabelSizeRange?: string;
  generationMode?: VisualGenerationMode;
  outputInstruction?: string;
  headerText: string;
  footerText: string;
  logoPath: string;
  safeMargins: string;
  layoutPreset: LayoutPreset;
  backgroundPreset: BackgroundPreset;
  intent: string;
  exactVisibleText: string;
  imageBrief: string;
};

function block(title: string, lines: Array<string | undefined>): string {
  return `${title}\n${lines.filter((line) => line?.trim()).join("\n")}`;
}

function buildLandscapeSlidePrompt(input: VisualPromptTemplateInput): string {
  const generationMode = input.generationMode || "direct_chatgpt";
  const deckFrame = generationMode === "direct_chatgpt"
    ? block("DECK FRAME", [
        "Generation mode: direct_chatgpt",
        `Header: ${input.headerText}`,
        "Header zone: 8-10% of visual height.",
        `Footer: ${input.footerText}`,
        "Footer zone: 6-8% of visual height.",
        `Logo: ${input.logoPath || "official brand logo"}`,
        "Logo rule: place the official logo in the header, fit within the header zone, preserve aspect ratio, do not crop, stretch, recolour, redraw or replace it.",
        `Safe margins: ${input.safeMargins}`,
        "Keep the header, footer, logo placement, margins and deck-frame styling consistent across visuals in this deck.",
      ])
    : block("DECK FRAME", [
        "Generation mode: app_composited",
        "Create the body visual only. The app applies the master frame, including the header, footer and official logo.",
        `Safe margins: ${input.safeMargins}`,
      ]);

  return [
    block("TASK", [
      `Create one 16:9 landscape image visual titled "${input.contentTitle}" for ${input.brandName}. Use the ${input.projectName} context.`,
    ]),
    block("SOURCE OF TRUTH", [
      "Use only the text inside BEGIN EXACT VISIBLE TEXT / END EXACT VISIBLE TEXT as on-image text. Everything else is design guidance.",
    ]),
    block("BRAND + PROJECT", [
      `Brand: ${input.brandName}`,
      `Project: ${input.projectName}`,
      input.projectContext ? `Project context: ${input.projectContext}` : "",
      `Brand design: ${input.themeStyle || input.visualTone || "Use premium executive styling appropriate to the brand."}`,
      `Brand colours: ${input.brandColours}`,
      `Font style: ${input.fontStyle || "Use a clean executive sans-serif with strong hierarchy."}`,
    ]),
    deckFrame,
    block("TYPOGRAPHY", [
      `Title: ${input.titleSizeRange || "28-36 pt"}`,
      `Section headings: ${input.sectionHeadingSizeRange || "18-24 pt"}`,
      `Body: ${input.bodySizeRange || "16-22 pt"}`,
      `Small labels: ${input.smallLabelSizeRange || "12-14 pt"}`,
      "Use strong hierarchy, high contrast and screen-readable spacing.",
    ]),
    block("CONTENT", [
      input.intent ? `Intent: ${input.intent}` : "",
      "",
      "BEGIN EXACT VISIBLE TEXT",
      input.exactVisibleText,
      "END EXACT VISIBLE TEXT",
    ]),
    block("IMAGE DIRECTION", [
      `Layout preset: ${input.layoutPreset.id} - ${input.layoutPreset.prompt}`,
      `Background preset: ${input.backgroundPreset.id} - ${input.backgroundPreset.prompt}`,
      input.imageBrief ? `Image brief: ${input.imageBrief}` : "",
    ]),
    block("GUARDRAILS", [
      "Do not add unsupported claims, fake metrics, extra visible text, generic dashboards or clutter.",
      "Do not alter, omit, duplicate, rewrite or reorder the exact visible wording.",
      "Do not distort, redraw, recolour, crop, stretch or invent the logo.",
    ]),
  ].join("\n\n").trim();
}

function buildLegacyImagePrompt(input: VisualPromptTemplateInput): string {
  const frame = getMasterFrameSpec(input.profileId);
  const outputChrome = block("APP-RENDERED MASTER FRAME", [
        `Final canvas: ${frame?.width || "profile"}x${frame?.height || "profile"} px.`,
        frame ? `Reserved body area: x=${frame.body.x}, y=${frame.body.y}, width=${frame.body.width}, height=${frame.body.height} px.` : "Use the profile body area.",
        `Typography for this output:\n${input.fontRules}`,
        "The app—not the image model—will render the locked header bar, footer bar, official logo, header text and footer text after generation.",
        "Do not draw, imitate, place or reserve a visible placeholder for the logo.",
      ]);
  const directFallback = block("DIRECT CHATGPT FALLBACK ONLY", [
    `If explicitly producing a direct final image without app post-processing, extend the artwork to ${frame?.width || "the final profile width"}x${frame?.height || "the final profile height"}px, keep a clear top zone for header text "${input.headerText}" and a clear bottom zone for footer text "${input.footerText}".`,
    "Do not draw or recreate the logo; leave the configured logo bounding-box area visually clear.",
    "This is fallback guidance only. The production workflow must use the app-rendered master frame.",
  ]);

  return [
    block("TASK", [
      `Create one ${input.outputFormat} visual titled "${input.contentTitle}" for ${input.brandName}. Use the ${input.projectName} context.`,
    ]),
    block("SOURCE OF TRUTH", [
      "Use only the text inside BEGIN EXACT VISIBLE TEXT / END EXACT VISIBLE TEXT as on-image text. Everything else is design guidance.",
    ]),
    block("BRAND + PROJECT", [
      `Brand: ${input.brandName}`,
      `Project: ${input.projectName}`,
      input.projectContext ? `Project context: ${input.projectContext}` : "",
      `Brand colours: ${input.brandColours}`,
      input.visualTone ? `Visual tone: ${input.visualTone}` : "",
      input.themeStyle ? `Theme/style: ${input.themeStyle}` : "",
    ]),
    block("OUTPUT PROFILE", [
      `Format: ${input.outputFormat}`,
      input.outputUseCase ? `Use case: ${input.outputUseCase}` : "",
      buildBodyArtworkInstruction(input.profileId),
      input.outputInstruction || "",
    ]),
    outputChrome,
    directFallback,
    block("VISUAL DIRECTION", [
      `Layout preset: ${input.layoutPreset.id} - ${input.layoutPreset.prompt}`,
      `Background preset: ${input.backgroundPreset.id} - ${input.backgroundPreset.prompt}`,
    ]),
    block("CONTENT SOURCE", [
      input.intent ? `Intent (guidance only): ${input.intent}` : "",
      input.imageBrief ? `Image brief (guidance only): ${input.imageBrief}` : "",
      "BEGIN EXACT VISIBLE TEXT",
      input.exactVisibleText,
      "END EXACT VISIBLE TEXT",
    ]),
    block("GUARDRAILS", [
      "Do not add unsupported claims, fake metrics, extra visible text, generic dashboards or clutter.",
      "Do not alter, omit, duplicate, rewrite or reorder the exact visible wording.",
      "Do not draw, distort, invent or place a logo. Return body artwork only; the app applies production chrome.",
    ]),
  ].join("\n\n").trim();
}

export function buildVisualProductionPrompt(input: VisualPromptTemplateInput): string {
  return input.profileId === "landscape_image_16_9"
    ? buildLandscapeSlidePrompt(input)
    : buildLegacyImagePrompt(input);
}
