export type ContentSetType = "documents" | "visuals" | "linkedin";

export const contentSetTypes: ContentSetType[] = ["documents", "visuals", "linkedin"];

export const defaultContentSetNames: Record<ContentSetType, string> = {
  documents: "default-document-pack",
  visuals: "default-visual-set",
  linkedin: "default-campaign",
};

export const contentSetDescriptorNames: Record<ContentSetType, string> = {
  documents: "pack.md",
  visuals: "set.md",
  linkedin: "campaign.md",
};

const ignoredSegments = new Set(["_generated", "generated-content", "node_modules"]);

export function isIgnoredContentPath(input: string): boolean {
  return input
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .some((segment) => ignoredSegments.has(segment.toLowerCase()) || segment.startsWith("."));
}

export function isContentSetDescriptor(type: ContentSetType, filename: string): boolean {
  return filename.toLowerCase() === contentSetDescriptorNames[type];
}

export function parseContentSetPath(input: string): {
  type: ContentSetType;
  contentSet: string;
  filename: string;
  isDescriptor: boolean;
} | undefined {
  const parts = input.replace(/\\/g, "/").split("/").filter(Boolean);
  const typeIndex = parts.findIndex((part) => contentSetTypes.includes(part as ContentSetType));
  if (typeIndex < 0 || parts.length < typeIndex + 3 || isIgnoredContentPath(input)) return undefined;

  const type = parts[typeIndex] as ContentSetType;
  const contentSet = parts[typeIndex + 1];
  const filename = parts[parts.length - 1];
  if (!contentSet || !filename.toLowerCase().endsWith(".md")) return undefined;

  return {
    type,
    contentSet,
    filename,
    isDescriptor: isContentSetDescriptor(type, filename) || filename.toLowerCase() === "readme.md",
  };
}

export function normalizeVersionFolder(input?: string): string {
  const match = input?.trim().match(/(?:v|version\s*)?0*(\d+)/i);
  const version = Math.max(1, Number(match?.[1] || 1));
  return `v${String(version).padStart(3, "0")}`;
}

export function getNextVersionFolder(existingFolders: Iterable<string>): string {
  let highest = 0;
  for (const folder of existingFolders) {
    const match = folder.trim().match(/^v(\d{3,})$/i);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `v${String(highest + 1).padStart(3, "0")}`;
}

export function contentSetGeneratedPath(type: ContentSetType, contentSet: string, version: string): string {
  return `${type}/${contentSet}/_generated/${normalizeVersionFolder(version)}`;
}
