import type { ParsedMarkdown } from "./types";

const headingRegex = /^##\s+(.+)$/gm;

export function parseMarkdownSections(markdown: string): ParsedMarkdown {
  const sections: Record<string, string> = {};
  const matches = Array.from(markdown.matchAll(headingRegex));

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const title = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = next?.index ?? markdown.length;
    sections[title] = markdown.slice(start, end).trim();
  }

  return { raw: markdown, sections };
}

export function getSection(parsed: ParsedMarkdown, name: string): string {
  return parsed.sections[name]?.trim() ?? "";
}
