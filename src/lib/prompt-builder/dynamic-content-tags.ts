import {
  getSection,
  ParsedSections,
  upsertMarkdownSections,
} from "./content-sections";
import { solveDynamicLayout } from "./layout-solver";
import { parseSemanticVisibleText } from "./semantic-visible-text";

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

function truncateSentence(input: string, maxLength: number): string {
  const clean = input.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}.`;
}

function visibleTextOnlySections(visibleText: string): ParsedSections {
  return {
    "visible text": visibleText,
  };
}

function concisePatternLabel(input: string): string {
  return sentenceCaseFromId(input).replace(/\s+/g, " ").trim();
}

function buildDynamicImageBrief(input: {
  brandLabel: string;
  projectLabel: string;
  layoutPresetId: string;
  backgroundPresetId: string;
  contentKind: string;
  visibleText: string;
}): string {
  const semantic = parseSemanticVisibleText(input.visibleText);
  const firstLines = semantic.exactLines.slice(0, 3).join(" | ");
  const structure = semantic.hasStructuredFields
    ? `Preserve grouped fields: ${semantic.fieldNames.slice(0, 6).join(", ")}.`
    : "Preserve the visible line order.";

  return [
    `Create a premium ${input.brandLabel} ${input.projectLabel} visual from Visible Text only.`,
    `Theme: ${concisePatternLabel(semantic.pattern)}; ${semantic.itemCount} item(s).`,
    `Layout: ${input.layoutPresetId}. Background: ${input.backgroundPresetId}.`,
    structure,
    `Core visible text: ${truncateSentence(firstLines || semantic.primaryTitle, 180)}`,
    "Do not add claims, labels, metrics or text not present in Visible Text.",
  ].join("\n");
}

export function generateDynamicContentTags(input: {
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  contentType: string;
  outputType: "image" | "document" | "pdf" | "text" | "email";
  sections: ParsedSections;
  selectedLayoutPresetId?: string;
  selectedBackgroundPresetId?: string;
}): DynamicContentTagUpdate {
  const visibleText = getSection(input.sections, "Visible Text");
  const semantic = parseSemanticVisibleText(visibleText);
  const title = titleFromVisibleText(visibleText, input.contentLabel);
  const dynamicSections = visibleTextOnlySections(visibleText);

  const plan = solveDynamicLayout({
    contentLabel: input.contentLabel,
    contentType: input.contentType,
    outputType: input.outputType,
    sections: dynamicSections,
    requestedLayoutPresetId: input.selectedLayoutPresetId,
    requestedBackgroundPresetId: input.selectedBackgroundPresetId,
  });

  const updates: Record<string, string> = {
    Intent: truncateSentence(
      `Create a ${input.brandLabel} ${input.projectLabel} visual for "${title}" using Visible Text only; do not add unsupported claims.`,
      180
    ),
    "Layout Hint": plan.layoutPresetId,
    "Background Hint": plan.backgroundPresetId,
  };

  if (input.outputType === "image") {
    updates["Image Brief"] = buildDynamicImageBrief({
      brandLabel: input.brandLabel,
      projectLabel: input.projectLabel,
      layoutPresetId: plan.layoutPresetId,
      backgroundPresetId: plan.backgroundPresetId,
      contentKind: plan.contentKind,
      visibleText,
    });
  }

  return {
    updates,
    summary: [
      `Detected content type: ${sentenceCaseFromId(plan.contentKind)}`,
      `Semantic pattern: ${semantic.pattern}`,
      `Semantic items: ${semantic.itemCount}`,
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
