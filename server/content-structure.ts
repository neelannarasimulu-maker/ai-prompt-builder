import fs from "node:fs";
import path from "node:path";
import {
  contentSetDescriptorNames,
  defaultContentSetNames,
  getNextVersionFolder,
  normalizeVersionFolder,
  type ContentSetType,
} from "../src/lib/prompt-builder/content-set-paths";

export type MigrationMove = { from: string; to: string };

function ensureDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true });
}

function uniquePath(directory: string, filename: string): string {
  const parsed = path.parse(filename);
  let candidate = path.join(directory, filename);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }
  return candidate;
}

function removeEmptyDirectories(directory: string): void {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) removeEmptyDirectories(path.join(directory, entry.name));
  }
  if (fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
}

function defaultSetName(projectFolder: string, type: ContentSetType): string {
  const normalized = projectFolder.replace(/\\/g, "/").toLowerCase();
  if (type === "visuals" && normalized.endsWith("/supplysync360/executive-overview")) {
    return "executive-overview-deck";
  }
  return defaultContentSetNames[type];
}

export function ensureContentSet(projectFolder: string, type: ContentSetType, setName = defaultSetName(projectFolder, type)): string {
  const setFolder = path.join(projectFolder, type, setName);
  const descriptor = path.join(setFolder, contentSetDescriptorNames[type]);
  ensureDirectory(path.join(setFolder, "_generated"));
  if (!fs.existsSync(descriptor)) {
    const label = setName.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
    fs.writeFileSync(descriptor, `# ${label}\n`, "utf8");
  }
  return setFolder;
}

export function getNextVersionFolderOnDisk(generatedFolder: string): string {
  const existing = fs.existsSync(generatedFolder)
    ? fs.readdirSync(generatedFolder, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    : [];
  return getNextVersionFolder(existing);
}

function migrateFlatSources(projectFolder: string, type: ContentSetType, moves: MigrationMove[]): void {
  const typeFolder = path.join(projectFolder, type);
  if (!fs.existsSync(typeFolder)) return;
  const setFolder = ensureContentSet(projectFolder, type);
  const descriptorName = contentSetDescriptorNames[type];

  for (const entry of fs.readdirSync(typeFolder, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md") || entry.name === descriptorName) continue;
    const source = path.join(typeFolder, entry.name);
    const target = uniquePath(setFolder, entry.name);
    fs.renameSync(source, target);
    moves.push({ from: source, to: target });
  }
}

function oldGeneratedType(name: string): ContentSetType | undefined {
  if (name === "visuals" || name === "backgrounds") return "visuals";
  if (name === "documents" || name === "pdfs" || name === "final-renders") return "documents";
  if (name === "linkedin" || name === "linkedin-posts") return "linkedin";
  return undefined;
}

function filesRecursively(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? filesRecursively(fullPath) : [fullPath];
  });
}

function migrateGeneratedCategory(projectFolder: string, categoryFolder: string, type: ContentSetType, moves: MigrationMove[]): void {
  const setFolder = ensureContentSet(projectFolder, type);
  const generatedFolder = path.join(setFolder, "_generated");
  const entries = fs.readdirSync(categoryFolder, { withFileTypes: true });
  const versionDirectories = entries.filter((entry) => entry.isDirectory());
  const looseFiles = entries.filter((entry) => entry.isFile()).map((entry) => path.join(categoryFolder, entry.name));
  const groups = [
    ...(looseFiles.length ? [{ name: "", files: looseFiles }] : []),
    ...versionDirectories.map((entry) => ({ name: entry.name, files: filesRecursively(path.join(categoryFolder, entry.name)) })),
  ];

  for (const group of groups) {
    if (!group.files.length) continue;
    const preferred = group.name ? normalizeVersionFolder(group.name) : "v001";
    const version = fs.existsSync(path.join(generatedFolder, preferred))
      ? getNextVersionFolderOnDisk(generatedFolder)
      : preferred;
    const targetFolder = path.join(generatedFolder, version);
    ensureDirectory(targetFolder);
    for (const source of group.files) {
      const target = uniquePath(targetFolder, path.basename(source));
      fs.renameSync(source, target);
      moves.push({ from: source, to: target });
    }
  }
}

export function migrateProjectStructure(projectFolder: string): MigrationMove[] {
  const moves: MigrationMove[] = [];
  for (const type of ["documents", "visuals", "linkedin"] as ContentSetType[]) {
    migrateFlatSources(projectFolder, type, moves);
    ensureContentSet(projectFolder, type);
  }

  const oldRoot = path.join(projectFolder, "generated-content");
  if (fs.existsSync(oldRoot)) {
    for (const entry of fs.readdirSync(oldRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const type = oldGeneratedType(entry.name);
        if (type) migrateGeneratedCategory(projectFolder, path.join(oldRoot, entry.name), type, moves);
      } else if (entry.isFile() && entry.name.toLowerCase() === "readme.md") {
        const setFolder = ensureContentSet(projectFolder, "documents");
        const generatedFolder = path.join(setFolder, "_generated");
        const version = fs.existsSync(path.join(generatedFolder, "v001")) ? "v001" : getNextVersionFolderOnDisk(generatedFolder);
        const targetFolder = path.join(generatedFolder, version);
        ensureDirectory(targetFolder);
        const target = uniquePath(targetFolder, "generation-notes.md");
        const source = path.join(oldRoot, entry.name);
        fs.renameSync(source, target);
        moves.push({ from: source, to: target });
      }
    }
    removeEmptyDirectories(oldRoot);
  }
  return moves;
}
