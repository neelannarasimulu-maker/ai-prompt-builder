import {
  getSection,
  ParsedSections,
  upsertMarkdownSections,
} from "./content-sections";
import { solveDynamicLayout } from "./layout-solver";
import {
  parseSemanticVisibleText,
  semanticItemsToPromptSummary,
} from "./semantic-visible-text";

export type DynamicContentTagUpdate = {
  updates: Record<string, string>;
  summary: string[];
};

function sentenceCaseFromId(id: string): string {
  return id
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function titleFromVisibleText(visibleText: string, fallback: string): string {
  const semantic = parseSemanticVisibleText(visibleText);
  return semantic.primaryTitle || fallback;
}

function buildDynamicImageBrief(input: {
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  sections: ParsedSections;
  layoutPresetId: string;
  backgroundPresetId: string;
  contentKind: string;
}): string {
  const existingBrief = getSection(input.sections, "Image Brief");
  const visibleText = getSection(input.sections, "Visible Text");
  const semantic = parseSemanticVisibleText(visibleText);
  const semanticSummary = semanticItemsToPromptSummary(semantic);

  const cleanExisting = existingBrief
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("dynamic layout:"))
    .filter((line) => !line.toLowerCase().startsWith("dynamic background:"))
    .filter((line) => !line.toLowerCase().startsWith("semantic structure:"))
    .join("\n");

  const baseScene =
    cleanExisting ||
    `Create a premium ${input.brandLabel} ${input.projectLabel} visual using the actual supplied Visible Text as the source of truth.`;

  return [
    baseScene,
    "",
    `Dynamic layout: ${input.layoutPresetId}.`,
    `Dynamic background: ${input.backgroundPresetId}.`,
    `Content type detected: ${input.contentKind}.`,
    `Semantic structure: ${semantic.pattern} with ${semantic.itemCount} item(s).`,
    "",
    "Semantic Visible Text interpretation:",
    semanticSummary,
    "",
    "Use the field labels to infer the visual structure only. Do not display field labels unless they are useful for readability.",
    "Keep each Title with its matching Body, Status, Remaining, Option, Phase, Timeline, Date, Lane or Item fields.",
    "Create the image around the layout zones, not as a finished background that text is pasted onto later.",
    "Reserve clean space for text zones, header and footer.",
    "Use the selected brand colours, gradients, logo rules and project visual style.",
    "Use medium-to-deep branded depth with lighter readable content zones.",
    "Preserve the supplied visible text exactly. Do not add unsupported claims, fake metrics, fake dashboard text or generic stock-style visuals.",
  ].join("\n");
}

export function generateDynamicContentTags(input: {
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  contentType: string;
  outputType: "image" | "document" | "pdf" | "text";
  sections: ParsedSections;
  selectedLayoutPresetId?: string;
  selectedBackgroundPresetId?: string;
}): DynamicContentTagUpdate {
  const visibleText = getSection(input.sections, "Visible Text");
  const semantic = parseSemanticVisibleText(visibleText);
  const title = titleFromVisibleText(visibleText, input.contentLabel);

  const plan = solveDynamicLayout({
    contentLabel: input.contentLabel,
    contentType: input.contentType,
    outputType: input.outputType,
    sections: input.sections,
    requestedLayoutPresetId: input.selectedLayoutPresetId,
    requestedBackgroundPresetId: input.selectedBackgroundPresetId,
  });

  const updates: Record<string, string> = {
    Intent: `Create the ${title} output for ${input.brandLabel} ${input.projectLabel} using the supplied content and selected brand system. Use actual input text only and do not add unsupported claims.`,
    "Layout Hint": plan.layoutPresetId,
    "Background Hint": plan.backgroundPresetId,
  };

  if (input.outputType === "image") {
    updates["Image Brief"] = buildDynamicImageBrief({
      brandLabel: input.brandLabel,
      projectLabel: input.projectLabel,
      contentLabel: input.contentLabel,
      sections: input.sections,
      layoutPresetId: plan.layoutPresetId,
      backgroundPresetId: plan.backgroundPresetId,
      contentKind: plan.contentKind,
    });
  }

  return {
    updates,
    summary: [
      `Detected content type: ${sentenceCaseFromId(plan.contentKind)}`,
      `Semantic pattern: ${semantic.pattern}`,
      `Semantic items: ${semantic.itemCount}`,
      `Fields: ${semantic.fieldNames.join(", ") || "none"}`,
      `Text density: ${plan.density.level} (${plan.density.lineCount} lines, ${plan.density.wordCount} words)`,
      `Layout selected: ${plan.layoutPresetId}`,
      `Background selected: ${plan.backgroundPresetId}`,
      ...plan.warnings,
    ],
  };
}

export function applyDynamicContentTagsToMarkdown(
  markdown: string,
  update: DynamicContentTagUpdate
): string {
  return upsertMarkdownSections(markdown, update.updates);
}
