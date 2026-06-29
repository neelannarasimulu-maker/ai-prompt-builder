export type SavedArtifactType =
  | "prompt"
  | "visual"
  | "document"
  | "pdf"
  | "text"
  | "other";

export type SavedArtifact = {
  id: string;
  title: string;
  artifactType: SavedArtifactType;
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  outputLabel: string;
  sourcePrompt: string;
  outputText?: string;
  assetUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
};

const STORAGE_KEY = "prompt-builder.saved-artifacts.v1";

function safeParse(value: string | null): SavedArtifact[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStorage(): SavedArtifact[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function writeStorage(items: SavedArtifact[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items, null, 2));
}

export function createArtifactId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function listSavedArtifacts(): SavedArtifact[] {
  return readStorage().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSavedArtifact(id: string): SavedArtifact | undefined {
  return readStorage().find((item) => item.id === id);
}

export function saveArtifact(
  artifact: Omit<SavedArtifact, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
): SavedArtifact {
  const now = new Date().toISOString();
  const existingItems = readStorage();
  const existing = artifact.id
    ? existingItems.find((item) => item.id === artifact.id)
    : undefined;

  const saved: SavedArtifact = {
    ...artifact,
    id: artifact.id ?? createArtifactId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const nextItems = existingItems
    .filter((item) => item.id !== saved.id)
    .concat(saved);

  writeStorage(nextItems);
  return saved;
}

export function deleteArtifact(id: string): void {
  writeStorage(readStorage().filter((item) => item.id !== id));
}

export function clearSavedArtifacts(): void {
  writeStorage([]);
}

export function exportSavedArtifactsJson(): string {
  return JSON.stringify(listSavedArtifacts(), null, 2);
}

export function artifactToMarkdown(artifact: SavedArtifact): string {
  const lines: string[] = [];

  lines.push(`# ${artifact.title}`);
  lines.push("");
  lines.push(`- Type: ${artifact.artifactType}`);
  lines.push(`- Brand: ${artifact.brandLabel}`);
  lines.push(`- Project: ${artifact.projectLabel}`);
  lines.push(`- Content: ${artifact.contentLabel}`);
  lines.push(`- Output: ${artifact.outputLabel}`);
  lines.push(`- Created: ${artifact.createdAt}`);
  lines.push(`- Updated: ${artifact.updatedAt}`);

  if (artifact.tags.length > 0) {
    lines.push(`- Tags: ${artifact.tags.join(", ")}`);
  }

  if (artifact.assetUrl) {
    lines.push(`- Asset URL: ${artifact.assetUrl}`);
  }

  if (artifact.notes) {
    lines.push("");
    lines.push("## Notes");
    lines.push("");
    lines.push(artifact.notes.trim());
  }

  if (artifact.outputText) {
    lines.push("");
    lines.push("## Generated Output");
    lines.push("");
    lines.push(artifact.outputText.trim());
  }

  lines.push("");
  lines.push("## Source Prompt");
  lines.push("");
  lines.push("```txt");
  lines.push(artifact.sourcePrompt.trim());
  lines.push("```");

  return lines.join("\n");
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}

export function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 90);
}
