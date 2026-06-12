import { linesFromBlock } from "./content-sections";
import {
  parseSemanticVisibleText,
  type SemanticVisibleTextAnalysis,
} from "./semantic-visible-text";

export type TextDensityLevel = "empty" | "light" | "medium" | "heavy" | "very_heavy";

export type TextDensityAnalysis = {
  level: TextDensityLevel;
  lineCount: number;
  wordCount: number;
  characterCount: number;
  longestLineLength: number;
  bulletLikeLineCount: number;
  semanticItemCount: number;
  semanticPattern: SemanticVisibleTextAnalysis["pattern"];
  recommendedMaxLines: number;
  suggestedTextTreatment: "hero" | "split" | "cards" | "multi_panel" | "document";
  warnings: string[];
};

function countWords(input: string): number {
  return input.trim() ? input.trim().split(/\s+/).length : 0;
}

function isBulletLike(line: string): boolean {
  return /^[-•*✓→↓]/.test(line.trim());
}

export function analyseVisibleText(visibleText?: string): TextDensityAnalysis {
  const lines = linesFromBlock(visibleText);
  const semantic = parseSemanticVisibleText(visibleText);
  const fullText = lines.join(" ");
  const lineCount = lines.length;
  const wordCount = countWords(fullText);
  const characterCount = fullText.length;
  const longestLineLength = lines.reduce(
    (max, line) => Math.max(max, line.length),
    0
  );
  const bulletLikeLineCount = lines.filter(isBulletLike).length;
  const itemCount = semantic.itemCount;

  let level: TextDensityLevel = "empty";
  let suggestedTextTreatment: TextDensityAnalysis["suggestedTextTreatment"] = "hero";
  const recommendedMaxLines = 10;

  if (lineCount === 0) {
    level = "empty";
    suggestedTextTreatment = "hero";
  } else if (itemCount >= 8 || lineCount > 18 || wordCount > 210) {
    level = "very_heavy";
    suggestedTextTreatment = "document";
  } else if (itemCount >= 5 || lineCount > 10 || wordCount > 110) {
    level = "heavy";
    suggestedTextTreatment = "multi_panel";
  } else if (itemCount >= 3 || lineCount > 5 || wordCount > 55) {
    level = "medium";
    suggestedTextTreatment = "cards";
  } else {
    level = "light";
    suggestedTextTreatment = "hero";
  }

  const warnings: string[] = [...semantic.warnings];

  if (lineCount > recommendedMaxLines && itemCount === 0) {
    warnings.push(
      `Visible Text has ${lineCount} lines. Use semantic fields or a multi-panel layout.`
    );
  }

  if (longestLineLength > 105) {
    warnings.push(
      "One or more visible text lines are long. Use wider text zones, cards, or compact typography."
    );
  }

  if (wordCount > 240) {
    warnings.push(
      "Visible Text is very dense for one visual. Consider splitting into multiple visuals or using a document output."
    );
  }

  return {
    level,
    lineCount,
    wordCount,
    characterCount,
    longestLineLength,
    bulletLikeLineCount,
    semanticItemCount: itemCount,
    semanticPattern: semantic.pattern,
    recommendedMaxLines,
    suggestedTextTreatment,
    warnings,
  };
}
