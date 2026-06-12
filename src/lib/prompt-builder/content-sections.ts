export type ParsedSection = {
  heading: string;
  key: string;
  body: string;
};

export type ParsedSections = Record<string, string>;

export const sectionOrder = [
  "Intent",
  "Layout Hint",
  "Background Hint",
  "Visible Text",
  "Image Brief",
  "Document Output Rules",
  "Body Content",
  "Post Brief",
  "Key Points",
  "Call To Action",
  "Optional Notes",
  "Content Constraints",
];

const ROOT_SECTION_ALIASES = [
  ...sectionOrder,
  "Source Intent",
  "Output Rules",
  "Constraints",
  "Body",
  "Document Body Content",
];

const ROOT_SECTION_KEYS = new Set(ROOT_SECTION_ALIASES.map(normalizeSectionKey));

const HEADING_LINE_RE = /^##\s+(.+)\s*$/;

export function normalizeSectionKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function compactBlock(input?: string): string {
  if (!input) return "";
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function compactSentence(input?: string): string {
  if (!input) return "";
  return input.replace(/\s+/g, " ").trim();
}

export function linesFromBlock(input?: string): string[] {
  if (!input) return [];
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function stripFrontmatter(markdown: string): string {
  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith("---")) return markdown;

  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return markdown;

  return trimmed.slice(end + 4).trimStart();
}

function findRootSectionMatches(markdown: string): Array<{ heading: string; key: string; start: number; lineEnd: number }> {
  const matches: Array<{ heading: string; key: string; start: number; lineEnd: number }> = [];
  const lines = markdown.split("\n");
  let offset = 0;

  for (const line of lines) {
    const match = line.match(HEADING_LINE_RE);
    if (match) {
      const heading = match[1].trim();
      const key = normalizeSectionKey(heading);
      if (ROOT_SECTION_KEYS.has(key)) {
        matches.push({
          heading,
          key,
          start: offset,
          lineEnd: offset + line.length,
        });
      }
    }
    offset += line.length + 1;
  }

  return matches;
}

export function parseMarkdownSectionList(markdown: string): ParsedSection[] {
  const cleaned = stripFrontmatter(markdown || "").replace(/\r\n/g, "\n");
  const matches = findRootSectionMatches(cleaned);

  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = match.lineEnd;
    const end = index + 1 < matches.length ? matches[index + 1].start : cleaned.length;

    return {
      heading: match.heading,
      key: match.key,
      body: cleaned.slice(start, end).trim(),
    };
  });
}

export function parseMarkdownSections(markdown: string): ParsedSections {
  const entries: Array<[string, string]> = [];

  for (const section of parseMarkdownSectionList(markdown)) {
    const body = compactBlock(section.body);
    if (!entries.some(([key]) => key === section.key)) {
      entries.push([section.key, body]);
    }
  }

  return Object.fromEntries(entries);
}

export function getSection(
  sections: ParsedSections,
  ...aliases: string[]
): string {
  for (const alias of aliases) {
    const key = normalizeSectionKey(alias);
    if (sections[key]) return sections[key];
  }
  return "";
}

export function firstMeaningfulLine(input?: string): string {
  if (!input) return "";
  return linesFromBlock(input)[0] ?? "";
}

export function sectionIdFromHint(input?: string): string {
  return firstMeaningfulLine(input)
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

export function upsertMarkdownSections(
  markdown: string,
  updates: Record<string, string>
): string {
  const existing = parseMarkdownSectionList(markdown);
  const updateByKey = Object.fromEntries(
    Object.entries(updates)
      .filter(([, value]) => compactBlock(value))
      .map(([heading, value]) => [normalizeSectionKey(heading), {
        heading,
        body: compactBlock(value),
      }])
  );

  const sectionByKey = new Map<string, ParsedSection>();

  for (const section of existing) {
    sectionByKey.set(section.key, section);
  }

  for (const [key, update] of Object.entries(updateByKey)) {
    const existingSection = sectionByKey.get(key);
    sectionByKey.set(key, {
      heading: existingSection?.heading || update.heading,
      key,
      body: update.body,
    });
  }

  const orderedKeys = sectionOrder.map(normalizeSectionKey);
  const used = new Set<string>();
  const output: ParsedSection[] = [];

  for (const key of orderedKeys) {
    const section = sectionByKey.get(key);
    if (!section) continue;
    output.push(section);
    used.add(key);
  }

  for (const section of existing) {
    if (used.has(section.key)) continue;
    const latest = sectionByKey.get(section.key) || section;
    output.push(latest);
    used.add(section.key);
  }

  for (const [key, update] of Object.entries(updateByKey)) {
    if (used.has(key)) continue;
    output.push({
      heading: update.heading,
      key,
      body: update.body,
    });
  }

  return output
    .map((section) => `## ${section.heading}\n${compactBlock(section.body)}`)
    .join("\n\n")
    .trim() + "\n";
}
