import { getSection, normalizeSectionKey, parseMarkdownSections, stripFrontmatter, upsertMarkdownSections } from "../lib/prompt-builder/content-sections";
import type { ReviewDashboardIssue } from "./prompt-review-dashboard";

const standardMissingSectionHeadings = new Set([
  "Image Brief",
  "Visible Text",
  "LinkedIn Post Text",
  "Layout Hint",
  "Background Hint",
]);

const previewSectionTemplates: Record<string, string> = {
  "Image Brief": "[Add the exact image composition, subject, style, and supporting scene guidance here.]",
  "Visible Text": "Title: [Add the exact on-image headline]\nBody: [Add concise exact wording]",
  "LinkedIn Post Text": "[Add the complete caption/post copy to paste into LinkedIn.]",
  "Layout Hint": "auto",
  "Background Hint": "auto",
};

export function isSafeInsertSection(section: string): boolean {
  return standardMissingSectionHeadings.has(section);
}

export function safeSectionTemplate(section: string): string {
  return previewSectionTemplates[section] ?? "[Add the required content here.]";
}

type MarkdownSectionRange = {
  key: string;
  heading: string;
  headingStart: number;
  headingEnd: number;
  start: number;
  end: number;
};

export function findMarkdownSectionRange(markdown: string, heading: string) {
  const normalized = stripFrontmatter(markdown || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const targetKey = normalizeSectionKey(heading);

  let offset = 0;
  let current: MarkdownSectionRange | null = null;
  let result: MarkdownSectionRange | null = null;

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)\s*$/);
    if (match) {
      if (current) {
        current.end = offset - 1;
        if (current.key === targetKey) result = current;
      }

      const headingText = match[1].trim();
      const headingStart = offset;
      const headingEnd = offset + line.length;
      current = {
        key: normalizeSectionKey(headingText),
        heading: headingText,
        headingStart,
        headingEnd,
        start: headingEnd + 1,
        end: normalized.length,
      };
    }

    offset += line.length + 1;
  }

  if (current && current.key === targetKey) {
    result = current;
  }

  return result && result.start <= result.end ? result : null;
}

export function shouldApplyMissingSection(issue: ReviewDashboardIssue, markdown: string) {
  const section = issue.guidance.likelySourceSection;
  if (!isSafeInsertSection(section)) return false;

  const sections = parseMarkdownSections(markdown);
  return !getSection(sections, section);
}

export function buildMissingSectionPreview(issue: ReviewDashboardIssue, markdown: string) {
  const section = issue.guidance.likelySourceSection;
  if (!shouldApplyMissingSection(issue, markdown)) return null;

  const oldText = markdown;
  const newText = upsertMarkdownSections(markdown, { [section]: safeSectionTemplate(section) });

  return {
    issueId: issue.id,
    section,
    oldText,
    newText,
  };
}

export function applyMissingSection(issue: ReviewDashboardIssue, markdown: string) {
  const section = issue.guidance.likelySourceSection;
  if (!shouldApplyMissingSection(issue, markdown)) return markdown;
  return upsertMarkdownSections(markdown, { [section]: safeSectionTemplate(section) });
}

export function formatSuggestedEditText(issue: ReviewDashboardIssue) {
  if (issue.suggestedFixes.length > 0) {
    return issue.suggestedFixes.join("\n\n");
  }

  return issue.guidance.suggestedEditGuidance;
}

export function showNonTrivialCopyOnly(issue: ReviewDashboardIssue, markdown: string) {
  return !shouldApplyMissingSection(issue, markdown);
}

export function extractSourceSectionName(section: string) {
  return section.trim();
}

export function normalizeSourceSectionKey(section: string) {
  return normalizeSectionKey(section);
}
