import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pptxgen from "pptxgenjs";
import { PDFDocument } from "pdf-lib";
import { renderLockedMasterFrame } from "./server/master-frame-renderer";
import { renderLockedDocument } from "./server/document-renderer";
import { getMasterFrameSpec } from "./src/lib/prompt-builder/master-frame";
import type { MasterFrameMetadata } from "./src/lib/prompt-builder/project-generated-content-api";
import {
  normalizeRpaImageFilename,
  normalizeRpaVersionLabel,
  validateRpaStartInput,
  type ChatGptRpaJob,
  type ChatGptRpaJobStatus,
  type ChatGptRpaStartInput,
  type ChatGptRpaStep,
  type ChatGptRpaStepStatus,
} from "./src/lib/prompt-builder/chatgpt-rpa";
import {
  filterLatestAssistDownload,
  normalizeAssistImageFilename,
  normalizeAssistVersionLabel,
  validateAssistImportInput,
  type AssistDownloadCandidate,
  type ChatGptAssistImportInput,
} from "./src/lib/prompt-builder/chatgpt-assist";
import {
  buildProjectScaffold,
  selectedScaffoldFiles,
  validateCreateProjectInput,
  type CreateProjectInput,
  type RuntimeContentFile,
  type RuntimeProject,
} from "./src/lib/prompt-builder/project-scaffold";
import {
  createDistributionRecordsFromDraft,
  validateDistributionDraft,
  validateDistributionRecord,
  withDefaultDistributionDate,
  type DistributionDraft,
  type DistributionRecord,
} from "./src/lib/prompt-builder/distribution";
import {
  readDistributionStoreFile,
  mergeDistributionStores,
  writeDistributionStoreFile,
  type DistributionStore,
} from "./server/distribution-store";
import {
  contentSetTypes,
  defaultContentSetNames,
  isIgnoredContentPath,
  normalizeVersionFolder,
  parseContentSetPath,
  type ContentSetType,
} from "./src/lib/prompt-builder/content-set-paths";
import {
  ensureContentSet,
  getNextVersionFolderOnDisk,
  migrateProjectStructure,
} from "./server/content-structure";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = __dirname;
const defaultContentRoot = path.join(projectRoot, "content");
const appSettingsPath = path.join(projectRoot, ".local", "app-settings.json");
type AppSettings = { contentRoot: string };
function readSettings(settingsPath: string): Partial<AppSettings> {
  try {
    return fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Partial<AppSettings>
      : {};
  } catch {
    return {};
  }
}
function findLegacySettings(): { settings: Partial<AppSettings>; path?: string } {
  const settingsDirectory = path.dirname(appSettingsPath);
  if (!fs.existsSync(settingsDirectory)) return { settings: {} };
  for (const entry of fs.readdirSync(settingsDirectory)) {
    const candidatePath = path.join(settingsDirectory, entry);
    if (candidatePath === appSettingsPath || path.extname(candidatePath).toLowerCase() !== ".json") continue;
    try {
      const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8")) as Record<string, unknown>;
      if (typeof candidate.contentRoot === "string" && typeof candidate.token === "string") {
        return { settings: { contentRoot: candidate.contentRoot }, path: candidatePath };
      }
    } catch {
      // Ignore unrelated or invalid local JSON files.
    }
  }
  return { settings: {} };
}
const savedAppSettings = readSettings(appSettingsPath);
const legacySettings = savedAppSettings.contentRoot ? { settings: {} } : findLegacySettings();
const migratedSettings = legacySettings.settings;
let contentRoot = path.resolve(process.env.PROMPT_BUILDER_CONTENT_ROOT || savedAppSettings.contentRoot || migratedSettings.contentRoot || defaultContentRoot);
const maxJsonBodyBytes = 25 * 1024 * 1024;
const maxUploadBytes = 18 * 1024 * 1024;
const maxExportBodyBytes = 2 * 1024 * 1024;
const maxRpaBodyBytes = 2 * 1024 * 1024;
const slideWidthInches = 13.333;
const slideHeightInches = 7.5;
const pdfPageWidth = 1920;
const pdfPageHeight = 1080;

type ChatGptRpaConfig = {
  chatGptUrl: string;
  userDataDir: string;
  browserChannel?: "chrome" | "msedge" | "chromium";
  headless: boolean;
  slowMoMs: number;
  timeouts: {
    loginMs: number;
    composerMs: number;
    generationMs: number;
    downloadMs: number;
  };
  selectors: {
    composer: string[];
    attachButton: string[];
    uploadMenuItem: string[];
    submitButton: string[];
    downloadButton: string[];
    generatedImage: string[];
    imagePreviewButton: string[];
    moreButton: string[];
  };
};

type ChatGptAssistConfig = {
  downloadsFolder: string;
};

type ChatGptRpaRuntimeJob = ChatGptRpaJob & {
  input: ChatGptRpaStartInput;
  context?: Awaited<ReturnType<typeof import("playwright").chromium.launchPersistentContext>>;
  page?: import("playwright").Page;
  cancelled?: boolean;
  running?: boolean;
};

const defaultChatGptRpaConfig: ChatGptRpaConfig = {
  chatGptUrl: "https://chatgpt.com/",
  userDataDir: "~/.ai-prompt-builder/chatgpt-rpa-profile",
  browserChannel: "chrome",
  headless: false,
  slowMoMs: 120,
  timeouts: {
    loginMs: 15000,
    composerMs: 30000,
    generationMs: 420000,
    downloadMs: 120000,
  },
  selectors: {
    composer: [
      "#prompt-textarea",
      "[contenteditable='true'][data-lexical-editor='true']",
      "textarea[placeholder*='Message']",
      "textarea",
    ],
    attachButton: [
      "button[aria-label*='Attach']",
      "button[aria-label*='Upload']",
      "[data-testid='composer-plus-btn']",
      "button:has-text('+')",
    ],
    uploadMenuItem: [
      "div[role='menuitem']:has-text('Upload')",
      "div[role='menuitem']:has-text('file')",
      "button:has-text('Upload')",
      "button:has-text('Add photos')",
      "button:has-text('Attach files')",
    ],
    submitButton: [
      "button[data-testid='send-button']",
      "button[aria-label*='Send']",
      "button:has-text('Send')",
    ],
    downloadButton: [
      "a[download]",
      "button[aria-label*='Download']",
      "a[aria-label*='Download']",
      "button:has-text('Download')",
    ],
    generatedImage: [
      "main img[src^='blob:']",
      "main img[src*='oaiusercontent']",
      "main img[src*='oaidalleapiprodscus']",
      "main img[alt*='Generated']",
      "main img",
    ],
    imagePreviewButton: [
      "main button:has(img)",
      "main a:has(img)",
      "main img",
    ],
    moreButton: [
      "button[aria-label*='More']",
      "button[aria-label*='Actions']",
      "button[aria-haspopup='menu']",
    ],
  },
};

const defaultChatGptAssistConfig: ChatGptAssistConfig = {
  downloadsFolder: "~/Downloads",
};

const chatGptRpaJobs = new Map<string, ChatGptRpaRuntimeJob>();

const allowedGeneratedCategories = new Set([
  "visuals",
  "documents",
  "linkedin",
]);
function ensureDirectory(directoryPath: string): void {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function saveAppSettings(): void {
  ensureDirectory(path.dirname(appSettingsPath));
  fs.writeFileSync(appSettingsPath, JSON.stringify({ contentRoot }, null, 2), "utf8");
  if (legacySettings.path && fs.existsSync(legacySettings.path)) fs.rmSync(legacySettings.path, { force: true });
}

if (!savedAppSettings.contentRoot && migratedSettings.contentRoot) saveAppSettings();

function contentPathFromRelative(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^content\/?/, "");
  return path.resolve(contentRoot, normalized);
}

function contentRelativePath(absolutePath: string): string {
  return `content/${path.relative(contentRoot, absolutePath).replace(/\\/g, "/")}`;
}

function initializeContentRoot(targetRoot: string): void {
  ensureDirectory(targetRoot);
  ensureDirectory(path.join(targetRoot, "projects"));
  const sourceBrands = path.join(defaultContentRoot, "brands");
  const targetBrands = path.join(targetRoot, "brands");
  if (fs.existsSync(sourceBrands)) fs.cpSync(sourceBrands, targetBrands, { recursive: true, force: false, errorOnExist: false });
}

function isInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function readRequestBody(req: import("node:http").IncomingMessage, maxBytes = maxJsonBodyBytes): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new Error(`Request body exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit.`));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: import("node:http").ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

function slugSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function safeFilename(value: string): string {
  const parsed = path.parse(value);
  const name = slugSegment(parsed.name || "generated-content");
  const ext = parsed.ext.toLowerCase().replace(/[^.a-z0-9]/g, "");
  return `${name}${ext || ".bin"}`;
}

function stripDuplicateExtensions(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 3) return filename;

  while (
    parts.length > 2 &&
    parts[parts.length - 1].toLowerCase() === parts[parts.length - 2].toLowerCase()
  ) {
    parts.pop();
  }

  return parts.join(".");
}

function getGeneratedFileVersionLabel(generatedRelativePath: string): string | undefined {
  const segments = generatedRelativePath.replace(/\\/g, "/").split("/");
  const version = segments.find((segment) => /^version\s+\d+(?:\.\d+)?$/i.test(segment.trim()));
  return version?.trim();
}

function getGeneratedFileDisplayName(filename: string): string {
  return stripDuplicateExtensions(filename)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueAvailablePath(directoryPath: string, filename: string): string {
  const parsed = path.parse(filename);
  let candidate = path.join(directoryPath, filename);
  let counter = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(directoryPath, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }

  return candidate;
}

function normalizeProjectFolder(projectFolder: string): string {
  return projectFolder.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function getProjectFolderAbsolute(projectFolder: string): string {
  const normalizedProjectFolder = normalizeProjectFolder(projectFolder);
  const absoluteProjectFolder = contentPathFromRelative(normalizedProjectFolder);

  if (!isInsideRoot(contentRoot, absoluteProjectFolder)) {
    throw new Error("Project folder must be inside the content folder.");
  }

  return absoluteProjectFolder;
}

function normalizeGeneratedCategory(category: string): ContentSetType {
  if (category === "linkedin-posts") return "linkedin";
  return allowedGeneratedCategories.has(category) ? category as ContentSetType : "documents";
}

function resolveContentSetName(projectFolder: string, type: ContentSetType, contentSet?: string): string {
  if (contentSet?.trim()) return slugSegment(contentSet);
  const projectRoot = getProjectFolderAbsolute(projectFolder);
  const typeRoot = path.join(projectRoot, type);
  if (fs.existsSync(typeRoot)) {
    const existing = fs.readdirSync(typeRoot, { withFileTypes: true })
      .find((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    if (existing) return existing.name;
  }
  return defaultContentSetNames[type];
}

function getGeneratedContentRoot(projectFolder: string, category = "documents", contentSet?: string): string {
  const type = normalizeGeneratedCategory(category);
  const setName = resolveContentSetName(projectFolder, type, contentSet);
  return path.join(getProjectFolderAbsolute(projectFolder), type, setName, "_generated");
}

function getDistributionStorePath(projectFolder: string): string {
  return path.join(getProjectFolderAbsolute(projectFolder), "distribution.json");
}

function readDistributionStore(projectFolder: string): DistributionStore {
  return readDistributionStoreFile(getDistributionStorePath(projectFolder));
}

function writeDistributionStore(projectFolder: string, store: DistributionStore): void {
  writeDistributionStoreFile(getDistributionStorePath(projectFolder), store);
}

function migrateLegacyDistributionStore(): void {
  const legacyPath = path.join(contentRoot, "distribution.json");
  if (!fs.existsSync(legacyPath)) return;
  const legacy = readDistributionStoreFile(legacyPath);
  const byProject = new Map<string, DistributionRecord[]>();
  for (const record of legacy.records) {
    byProject.set(record.projectFolder, [...(byProject.get(record.projectFolder) || []), record]);
  }
  for (const [projectFolder, records] of byProject) {
    const existing = readDistributionStore(projectFolder);
    writeDistributionStore(projectFolder, mergeDistributionStores(existing, records));
  }
  fs.rmSync(legacyPath, { force: true });
}

function distributionReferenceErrors(input: Pick<DistributionRecord, "projectFolder" | "contentSourcePath" | "generatedContentIds">): string[] {
  const errors: string[] = [];
  try {
    getProjectFolderAbsolute(input.projectFolder);
  } catch {
    errors.push("Project folder must be inside the configured content root.");
  }
  const refs = [input.contentSourcePath, ...input.generatedContentIds].filter(Boolean) as string[];
  for (const ref of refs) {
    const absolute = contentPathFromRelative(ref);
    if (!isInsideRoot(contentRoot, absolute) || ref.includes("..")) errors.push(`Invalid content reference: ${ref}`);
  }
  const projectPrefix = `${normalizeProjectFolder(input.projectFolder)}/`;
  if (input.contentSourcePath && !input.contentSourcePath.replace(/\\/g, "/").startsWith(projectPrefix)) {
    errors.push("Source content must belong to the selected project.");
  }
  for (const generatedId of input.generatedContentIds) {
    const normalized = generatedId.replace(/\\/g, "/");
    if (!normalized.startsWith(projectPrefix) || !normalized.includes("/_generated/")) {
      errors.push("Generated files must belong to the selected project.");
    }
  }
  return errors;
}

function getGeneratedCategoryFolder(input: {
  projectFolder: string;
  category: string;
  contentSet?: string;
}): string {
  return getGeneratedContentRoot(input.projectFolder, input.category, input.contentSet);
}

function walkFiles(directoryPath: string): string[] {
  if (!fs.existsSync(directoryPath)) return [];

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (!entry.name.startsWith(".")) {
      files.push(fullPath);
    }
  }

  return files;
}

function removeEmptyDirectoryTree(directoryPath: string): void {
  if (!fs.existsSync(directoryPath) || fs.lstatSync(directoryPath).isSymbolicLink()) return;
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) removeEmptyDirectoryTree(path.join(directoryPath, entry.name));
  }
  if (fs.readdirSync(directoryPath).length === 0) fs.rmdirSync(directoryPath);
}

function getFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();

  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if ([".docx", ".doc"].includes(ext)) return "document";
  if ([".pptx", ".ppt"].includes(ext)) return "presentation";
  if ([".md", ".txt", ".json", ".csv"].includes(ext)) return "text";
  return "other";
}

function getImageMimeType(filename: string): "image/png" | "image/jpeg" | undefined {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return undefined;
}

function getPngDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return undefined;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function getJpegDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return undefined;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);

    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return undefined;
}

function getImageDimensions(filename: string, buffer: Buffer): { width: number; height: number } {
  const ext = path.extname(filename).toLowerCase();
  const dimensions = ext === ".png" ? getPngDimensions(buffer) : getJpegDimensions(buffer);
  return dimensions || { width: 16, height: 9 };
}

function containRect(input: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(input.targetWidth / input.sourceWidth, input.targetHeight / input.sourceHeight);
  const width = input.sourceWidth * scale;
  const height = input.sourceHeight * scale;

  return {
    x: (input.targetWidth - width) / 2,
    y: (input.targetHeight - height) / 2,
    width,
    height,
  };
}

function getStringQueryParam(url: URL, name: string): string {
  return url.searchParams.get(name) || "";
}

function ensureGeneratedScaffold(projectFolder: string): void {
  const projectRoot = getProjectFolderAbsolute(projectFolder);
  migrateProjectStructure(projectRoot);
  for (const category of contentSetTypes) ensureContentSet(projectRoot, category);
}

function readJsonFile<T>(filename: string): Partial<T> {
  if (!fs.existsSync(filename)) return {};

  try {
    return JSON.parse(fs.readFileSync(filename, "utf8")) as Partial<T>;
  } catch {
    return {};
  }
}

function mergeChatGptRpaConfig(): ChatGptRpaConfig {
  const exampleConfig = readJsonFile<ChatGptRpaConfig>(path.join(projectRoot, "automation", "chatgpt-rpa.config.example.json"));
  const localConfig = readJsonFile<ChatGptRpaConfig>(path.join(projectRoot, "automation", "chatgpt-rpa.config.local.json"));
  const merged = {
    ...defaultChatGptRpaConfig,
    ...exampleConfig,
    ...localConfig,
    timeouts: {
      ...defaultChatGptRpaConfig.timeouts,
      ...exampleConfig.timeouts,
      ...localConfig.timeouts,
    },
    selectors: {
      ...defaultChatGptRpaConfig.selectors,
      ...exampleConfig.selectors,
      ...localConfig.selectors,
    },
  };

  return merged;
}

function mergeChatGptAssistConfig(): ChatGptAssistConfig {
  const exampleConfig = readJsonFile<ChatGptAssistConfig>(path.join(projectRoot, "automation", "chatgpt-assist.config.example.json"));
  const localConfig = readJsonFile<ChatGptAssistConfig>(path.join(projectRoot, "automation", "chatgpt-assist.config.local.json"));

  return {
    ...defaultChatGptAssistConfig,
    ...exampleConfig,
    ...localConfig,
  };
}

function resolveUserPath(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return path.resolve(projectRoot, input);
}

function getPathInsideProject(relativePath: string, label: string): string {
  const absolutePath = contentPathFromRelative(relativePath);

  if (!isInsideRoot(contentRoot, absolutePath)) {
    throw new Error(`${label} must be inside the content folder.`);
  }

  return absolutePath;
}

async function renderProductionArtwork(artwork: Buffer, masterFrame: MasterFrameMetadata): Promise<Buffer> {
  if (!["landscape_image_16_9", "portrait_image_4_5", "linkedin_asset_4_5"].includes(masterFrame.outputProfileId)) {
    throw new Error(`Unsupported image master-frame profile: ${masterFrame.outputProfileId}`);
  }
  if (!getMasterFrameSpec(masterFrame.outputProfileId)) {
    throw new Error(`Unsupported master-frame profile: ${masterFrame.outputProfileId}`);
  }
  return renderLockedMasterFrame({
    artwork,
    profileId: masterFrame.outputProfileId,
    headerText: masterFrame.headerText,
    footerText: masterFrame.footerText,
    logoPath: masterFrame.logoAsset ? getPathInsideProject(masterFrame.logoAsset, "Logo asset") : undefined,
  });
}

function getAssistVisualVersionFolder(input: {
  projectFolder: string;
  contentSet: string;
  versionLabel: string;
}): string {
  const visualsRoot = getGeneratedCategoryFolder({
    projectFolder: input.projectFolder,
    category: "visuals",
    contentSet: input.contentSet,
  });
  const versionFolder = path.join(visualsRoot, normalizeVersionFolder(input.versionLabel));

  if (!isInsideRoot(visualsRoot, versionFolder)) {
    throw new Error("Target version folder must stay inside the visual set's _generated folder.");
  }

  return versionFolder;
}

function listAssistDownloadCandidates(downloadsFolder: string): AssistDownloadCandidate[] {
  if (!fs.existsSync(downloadsFolder)) return [];

  return fs.readdirSync(downloadsFolder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolutePath = path.join(downloadsFolder, entry.name);
      const stats = fs.statSync(absolutePath);
      return {
        path: absolutePath,
        filename: entry.name,
        modifiedAt: stats.mtime,
        sizeBytes: stats.size,
      };
    });
}

function getRpaVisualVersionFolder(input: {
  projectFolder: string;
  contentSet: string;
  versionLabel: string;
}): string {
  const visualsRoot = getGeneratedCategoryFolder({
    projectFolder: input.projectFolder,
    category: "visuals",
    contentSet: input.contentSet,
  });
  const versionFolder = path.join(visualsRoot, normalizeVersionFolder(input.versionLabel));

  if (!isInsideRoot(visualsRoot, versionFolder)) {
    throw new Error("Target version folder must stay inside the visual set's _generated folder.");
  }

  return versionFolder;
}

function getRpaSavedOutputPath(input: {
  projectFolder: string;
  contentSet: string;
  versionLabel: string;
  outputFilename: string;
  downloadedFilename?: string;
}): string {
  const targetFolder = getRpaVisualVersionFolder(input);
  const filename = safeFilename(`${path.parse(normalizeRpaImageFilename(input.outputFilename, ".png")).name}.png`);
  const candidate = uniqueAvailablePath(targetFolder, filename);
  const visualsRoot = getGeneratedCategoryFolder({
    projectFolder: input.projectFolder,
    category: "visuals",
    contentSet: input.contentSet,
  });

  if (!isInsideRoot(visualsRoot, candidate)) {
    throw new Error("Refusing to save outside the visual set's _generated folder.");
  }

  return candidate;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createRpaJob(input: ChatGptRpaStartInput): ChatGptRpaRuntimeJob {
  const timestamp = nowIso();
  const steps: ChatGptRpaStep[] = [
    { id: "preflight", label: "Preflight checks", status: "queued", updatedAt: timestamp },
    { id: "browser", label: "Open ChatGPT browser", status: "queued", updatedAt: timestamp },
    { id: "login", label: "Confirm ChatGPT login", status: "queued", updatedAt: timestamp },
    { id: "compose", label: "Submit body-artwork prompt", status: "queued", updatedAt: timestamp },
    { id: "download", label: "Download generated image", status: "queued", updatedAt: timestamp },
    { id: "save", label: "Save to content-set version", status: "queued", updatedAt: timestamp },
  ];

  return {
    id: `rpa-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    input,
    status: "queued",
    steps,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function publicRpaJob(job: ChatGptRpaRuntimeJob): ChatGptRpaJob {
  const { context: _context, page: _page, input: _input, running: _running, cancelled: _cancelled, ...publicJob } = job;
  return publicJob;
}

function setRpaJobStatus(job: ChatGptRpaRuntimeJob, status: ChatGptRpaJobStatus, error?: string): void {
  job.status = status;
  job.updatedAt = nowIso();
  if (error) job.error = error;
}

function setRpaStep(
  job: ChatGptRpaRuntimeJob,
  stepId: string,
  status: ChatGptRpaStepStatus,
  message?: string
): void {
  const step = job.steps.find((item) => item.id === stepId);
  if (!step) return;
  step.status = status;
  step.message = message;
  step.updatedAt = nowIso();
  job.updatedAt = step.updatedAt;
}

async function firstVisibleLocator(page: import("playwright").Page, selectors: string[], timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      try {
        const locator = page.locator(selector).first();
        if (await locator.isVisible({ timeout: 750 })) return locator;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`No visible locator matched: ${selectors.join(", ")}`);
}

async function fillChatGptComposer(page: import("playwright").Page, selectors: string[], prompt: string): Promise<void> {
  const composer = await firstVisibleLocator(page, selectors, 30000);
  await composer.click();

  try {
    await composer.fill(prompt);
  } catch {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.type(prompt, { delay: 0 });
  }
}

async function clickFirstVisible(page: import("playwright").Page, selectors: string[], timeoutMs: number): Promise<void> {
  const locator = await firstVisibleLocator(page, selectors, timeoutMs);
  await locator.click();
}

async function waitForGeneratedImage(page: import("playwright").Page, selectors: string[], timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      try {
        const locators = page.locator(selector);
        const count = await locators.count();
        for (let index = count - 1; index >= 0; index -= 1) {
          const locator = locators.nth(index);
          if (!await locator.isVisible({ timeout: 500 })) continue;
          const box = await locator.boundingBox();
          if (box && box.width >= 180 && box.height >= 120) return locator;
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No generated image was visible before timeout.");
}

async function clickWithDownload(input: {
  page: import("playwright").Page;
  click: () => Promise<void>;
  timeoutMs: number;
}): Promise<import("playwright").Download | undefined> {
  try {
    const downloadPromise = input.page.waitForEvent("download", { timeout: input.timeoutMs });
    await input.click();
    return await downloadPromise;
  } catch {
    return undefined;
  }
}

async function tryDownloadFromVisibleControls(input: {
  page: import("playwright").Page;
  config: ChatGptRpaConfig;
}): Promise<import("playwright").Download | undefined> {
  for (const selector of input.config.selectors.downloadButton) {
    const locators = input.page.locator(selector);
    const count = await locators.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const locator = locators.nth(index);
      const isVisible = await locator.isVisible({ timeout: 600 }).catch(() => false);
      if (!isVisible) continue;
      const download = await clickWithDownload({
        page: input.page,
        timeoutMs: input.config.timeouts.downloadMs,
        click: async () => locator.click(),
      });
      if (download) return download;
    }
  }

  return undefined;
}

async function downloadGeneratedImageFromChatGpt(input: {
  page: import("playwright").Page;
  config: ChatGptRpaConfig;
}): Promise<import("playwright").Download> {
  const image = await waitForGeneratedImage(
    input.page,
    input.config.selectors.generatedImage,
    input.config.timeouts.generationMs
  );

  await image.scrollIntoViewIfNeeded().catch(() => undefined);
  await image.hover({ timeout: 3000 }).catch(() => undefined);

  let download = await tryDownloadFromVisibleControls(input);
  if (download) return download;

  const previewTargets = input.page.locator(input.config.selectors.imagePreviewButton.join(", "));
  const previewCount = await previewTargets.count().catch(() => 0);
  if (previewCount > 0) {
    const preview = previewTargets.nth(previewCount - 1);
    await preview.click({ timeout: 5000 }).catch(() => undefined);
    await input.page.waitForTimeout(1200);
    download = await tryDownloadFromVisibleControls(input);
    if (download) return download;
  }

  for (const selector of input.config.selectors.moreButton) {
    const buttons = input.page.locator(selector);
    const count = await buttons.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const button = buttons.nth(index);
      if (!await button.isVisible({ timeout: 500 }).catch(() => false)) continue;
      await button.click({ timeout: 3000 }).catch(() => undefined);
      await input.page.waitForTimeout(700);
      download = await tryDownloadFromVisibleControls(input);
      if (download) return download;
    }
  }

  throw new Error("Generated image is visible, but no downloadable image control was found. Open the image menu/download manually, then click Resume.");
}

async function runChatGptRpaJob(job: ChatGptRpaRuntimeJob, resumeFromWaiting = false): Promise<void> {
  if (job.running) return;
  job.running = true;

  try {
    const config = mergeChatGptRpaConfig();
    const { chromium } = await import("playwright");

    if (job.cancelled) return;

    setRpaJobStatus(job, "running");
    setRpaStep(job, "preflight", "running", "Validating prompt, locked frame and target folder.");

    const validationErrors = validateRpaStartInput(job.input);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(" "));
    }

    const logoPath = getPathInsideProject(job.input.logoAsset, "Logo asset");
    if (!fs.existsSync(logoPath) || !fs.statSync(logoPath).isFile()) {
      throw new Error(`Logo asset was not found: ${job.input.logoAsset}`);
    }

    ensureDirectory(getRpaVisualVersionFolder({
      projectFolder: job.input.projectFolder,
      contentSet: job.input.contentSet,
      versionLabel: job.input.versionLabel,
    }));
    setRpaStep(job, "preflight", "complete", "Preflight passed.");

    if (!job.context || !job.page) {
      setRpaStep(job, "browser", "running", "Launching visible persistent Chromium profile.");
      const userDataDir = resolveUserPath(config.userDataDir);
      ensureDirectory(userDataDir);
      const launchOptions = {
        acceptDownloads: true,
        headless: config.headless,
        slowMo: config.slowMoMs,
        viewport: { width: 1440, height: 960 },
        args: ["--new-window"],
      };
      try {
        job.context = await chromium.launchPersistentContext(userDataDir, {
          ...launchOptions,
          channel: config.browserChannel === "chromium" ? undefined : config.browserChannel,
        });
      } catch (error) {
        if (config.browserChannel && config.browserChannel !== "chromium") {
          job.context = await chromium.launchPersistentContext(userDataDir, launchOptions);
          setRpaStep(job, "browser", "running", `System ${config.browserChannel} was unavailable; using bundled Chromium.`);
        } else {
          throw error;
        }
      }
      job.page = job.context.pages()[0] || await job.context.newPage();
      await job.page.bringToFront().catch(() => undefined);
      await job.page.goto(config.chatGptUrl, { waitUntil: "domcontentloaded" });
      setRpaStep(job, "browser", "complete", "ChatGPT window is open.");
    } else if (!resumeFromWaiting) {
      await job.page.bringToFront();
    }

    const page = job.page;
    setRpaStep(job, "login", "running", "Checking for the ChatGPT composer.");
    try {
      await firstVisibleLocator(page, config.selectors.composer, config.timeouts.loginMs);
      setRpaStep(job, "login", "complete", "Composer is available.");
    } catch {
      setRpaStep(job, "login", "waiting", "Log in to ChatGPT in the opened browser, then click Resume.");
      setRpaJobStatus(job, "waiting_for_user");
      return;
    }

    if (job.cancelled) return;

    if (job.steps.find((step) => step.id === "compose")?.status !== "complete") {
      setRpaStep(job, "compose", "running", "Submitting the body-artwork prompt without attaching the logo.");

      await fillChatGptComposer(page, config.selectors.composer, job.input.prompt);
      await clickFirstVisible(page, config.selectors.submitButton, config.timeouts.composerMs);
      setRpaStep(job, "compose", "complete", "Prompt submitted.");
    }

    setRpaStep(job, "download", "running", "Waiting for image download control.");
    try {
      await page.bringToFront().catch(() => undefined);
      const download = await downloadGeneratedImageFromChatGpt({ page, config });
      const outputPath = getRpaSavedOutputPath({
        projectFolder: job.input.projectFolder,
        contentSet: job.input.contentSet,
        versionLabel: job.input.versionLabel,
        outputFilename: job.input.outputFilename,
        downloadedFilename: download.suggestedFilename(),
      });
      ensureDirectory(path.dirname(outputPath));

      setRpaStep(job, "download", "complete", `Downloaded ${download.suggestedFilename()}.`);
      setRpaStep(job, "save", "running", "Saving downloaded image into the content-set version folder.");
      const temporaryDownload = `${outputPath}.${crypto.randomUUID()}.download`;
      try {
        await download.saveAs(temporaryDownload);
        const framedArtwork = await renderProductionArtwork(fs.readFileSync(temporaryDownload), {
          outputProfileId: job.input.outputProfileId,
          headerText: job.input.headerText,
          footerText: job.input.footerText,
          logoAsset: job.input.logoAsset,
        });
        fs.writeFileSync(outputPath, framedArtwork);
      } finally {
        fs.rmSync(temporaryDownload, { force: true });
      }

      const relativeFromProjectRoot = contentRelativePath(outputPath);
      job.savedFile = {
        filename: path.basename(outputPath),
        relativePath: relativeFromProjectRoot,
        fileUrl: `/project-generated-content/${relativeFromProjectRoot}`,
      };
      setRpaStep(job, "save", "complete", `Saved as ${job.savedFile.filename}.`);
      setRpaJobStatus(job, "complete");
    } catch (error) {
      setRpaStep(job, "download", "waiting", "Image was not downloaded automatically. Use the visible ChatGPT window to open the image or its menu, then click Resume to try capture again.");
      setRpaJobStatus(job, "waiting_for_user", error instanceof Error ? error.message : "Download needs manual intervention.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ChatGPT RPA error.";
    const browserHint = /Executable doesn't exist|browser.*not.*installed|playwright install/i.test(message)
      ? `${message} Run: npx playwright install chromium`
      : message;
    setRpaJobStatus(job, "failed", browserHint);
    const runningStep = job.steps.find((step) => step.status === "running" || step.status === "queued");
    if (runningStep) setRpaStep(job, runningStep.id, "failed", job.error);
  } finally {
    job.running = false;
  }
}

function projectLabelFromMarkdown(markdown: string, fallback: string): string {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function runtimeProjectFromFolder(brandId: string, projectId: string, folder: string): RuntimeProject {
  const projectMarkdown = path.join(folder, "project.md");
  const raw = fs.existsSync(projectMarkdown) ? fs.readFileSync(projectMarkdown, "utf8") : "";
  const workflow = raw.match(/^Workflow:\s*(presentation|document_pack|linkedin_campaign|mixed)\s*$/mi)?.[1] as RuntimeProject["workflow"];
  return {
    id: projectId,
    label: projectLabelFromMarkdown(raw, projectId),
    brandId,
    folder: `content/projects/${brandId}/${projectId}`,
    workflow,
  };
}

function listRuntimeProjectsFromDisk(): RuntimeProject[] {
  const projectsRoot = path.join(contentRoot, "projects");
  if (!fs.existsSync(projectsRoot)) return [];
  const output: RuntimeProject[] = [];
  for (const brandEntry of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!brandEntry.isDirectory() || brandEntry.isSymbolicLink()) continue;
    const brandFolder = path.join(projectsRoot, brandEntry.name);
    for (const projectEntry of fs.readdirSync(brandFolder, { withFileTypes: true })) {
      if (!projectEntry.isDirectory() || projectEntry.isSymbolicLink() || projectEntry.name.startsWith(".tmp-")) continue;
      const project = runtimeProjectFromFolder(brandEntry.name, projectEntry.name, path.join(brandFolder, projectEntry.name));
      ensureGeneratedScaffold(project.folder);
      output.push(project);
    }
  }
  return output.sort((a, b) => a.label.localeCompare(b.label));
}

function runtimeContentFiles(project: RuntimeProject): RuntimeContentFile[] {
  const folder = contentPathFromRelative(project.folder);
  return walkFiles(folder)
    .filter((filename) => filename.toLowerCase().endsWith(".md"))
    .filter((filename) => !isIgnoredContentPath(path.relative(folder, filename)))
    .map((filename): RuntimeContentFile | undefined => {
      const relative = path.relative(folder, filename).replace(/\\/g, "/");
      const parsed = parseContentSetPath(relative);
      if (parsed?.isDescriptor) return undefined;
      const base = path.basename(filename);
      return {
        path: contentRelativePath(filename),
        type: parsed?.type || "project",
        contentSet: parsed?.contentSet,
        filename: base,
        label: getGeneratedFileDisplayName(base),
        raw: fs.readFileSync(filename, "utf8"),
      };
    })
    .filter((file): file is RuntimeContentFile => Boolean(file))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function localFilePlugin(): Plugin {
  return {
    name: "prompt-builder-persist-output-name-api",
    configureServer(server) {
      server.middlewares.use("/api/storage/status", (_req, res) => {
        let writable = false;
        try {
          ensureDirectory(contentRoot);
          fs.accessSync(contentRoot, fs.constants.R_OK | fs.constants.W_OK);
          writable = true;
        } catch {
          writable = false;
        }
        sendJson(res, 200, { ok: true, localApiAvailable: true, contentRoot, writable, version: "1.0" });
      });

      server.middlewares.use("/api/storage/settings", async (req, res) => {
        if (req.method !== "PUT") {
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
          return;
        }
        try {
          const body = JSON.parse(await readRequestBody(req)) as { contentRoot?: string; initialize?: boolean };
          if (!body.contentRoot || !path.isAbsolute(body.contentRoot)) {
            sendJson(res, 400, { ok: false, error: "Content root must be an absolute filesystem path." });
            return;
          }
          const nextRoot = path.resolve(body.contentRoot);
          if (body.initialize) initializeContentRoot(nextRoot);
          if (!fs.existsSync(nextRoot) || !fs.statSync(nextRoot).isDirectory()) {
            sendJson(res, 400, { ok: false, error: "Content root does not exist. Enable initialization to create it." });
            return;
          }
          fs.accessSync(nextRoot, fs.constants.R_OK | fs.constants.W_OK);
          contentRoot = nextRoot;
          saveAppSettings();
          sendJson(res, 200, { ok: true, localApiAvailable: true, contentRoot, writable: true, version: "1.0" });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Could not update content root." });
        }
      });

      server.middlewares.use("/api/projects/preview", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
          return;
        }
        try {
          const input = JSON.parse(await readRequestBody(req)) as CreateProjectInput;
          sendJson(res, 200, buildProjectScaffold(input));
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Could not preview project." });
        }
      });

      server.middlewares.use("/api/projects", async (req, res) => {
        const requestPath = decodeURIComponent(req.url || "/").split("?")[0];
        const parts = requestPath.replace(/^\/+/, "").split("/").filter(Boolean);
        if (req.method === "GET" && parts.length === 0) {
          sendJson(res, 200, { ok: true, projects: listRuntimeProjectsFromDisk() });
          return;
        }
        if (req.method === "GET" && parts.length === 2) {
          const project = listRuntimeProjectsFromDisk().find((item) => item.brandId === parts[0] && item.id === parts[1]);
          if (!project) {
            sendJson(res, 404, { ok: false, error: "Project not found." });
            return;
          }
          sendJson(res, 200, { ok: true, project, files: runtimeContentFiles(project) });
          return;
        }
        if (req.method !== "POST" || parts.length > 0) {
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
          return;
        }
        let stageFolder = "";
        try {
          const input = JSON.parse(await readRequestBody(req)) as CreateProjectInput;
          const validationErrors = validateCreateProjectInput(input);
          if (validationErrors.length) {
            sendJson(res, 400, { ok: false, error: validationErrors.join(" ") });
            return;
          }
          const brandFolder = path.join(contentRoot, "brands", input.brandId);
          if (!fs.existsSync(brandFolder) || !fs.statSync(brandFolder).isDirectory() || fs.lstatSync(brandFolder).isSymbolicLink()) {
            sendJson(res, 400, { ok: false, error: `Brand ${input.brandId} is not available in the configured content root.` });
            return;
          }
          const parentFolder = path.join(contentRoot, "projects", input.brandId);
          ensureDirectory(parentFolder);
          const collision = fs.readdirSync(parentFolder).some((name) => name.toLowerCase() === input.projectSlug.toLowerCase());
          if (collision) {
            sendJson(res, 409, { ok: false, error: `Project ${input.projectSlug} already exists for this brand.` });
            return;
          }
          const targetFolder = path.join(parentFolder, input.projectSlug);
          stageFolder = path.join(parentFolder, `.tmp-${input.projectSlug}-${crypto.randomUUID()}`);
          ensureDirectory(stageFolder);
          const preview = buildProjectScaffold(input);
          for (const file of selectedScaffoldFiles(input)) {
            const targetFile = path.resolve(stageFolder, file.path);
            if (!isInsideRoot(stageFolder, targetFile)) throw new Error(`Invalid scaffold path: ${file.path}`);
            ensureDirectory(path.dirname(targetFile));
            fs.writeFileSync(targetFile, file.content, "utf8");
          }
          for (const folder of preview.generatedFolders) ensureDirectory(path.join(stageFolder, folder));
          fs.renameSync(stageFolder, targetFolder);
          stageFolder = "";
          const project = runtimeProjectFromFolder(input.brandId, input.projectSlug, targetFolder);
          sendJson(res, 201, { ok: true, project, files: runtimeContentFiles(project), preview });
        } catch (error) {
          if (stageFolder && fs.existsSync(stageFolder)) fs.rmSync(stageFolder, { recursive: true, force: true });
          sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Could not create project." });
        }
      });

      server.middlewares.use("/api/content/save", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
          return;
        }

        try {
          const body = JSON.parse(await readRequestBody(req)) as {
            path?: string;
            content?: string;
          };

          if (!body.path || typeof body.content !== "string") {
            sendJson(res, 400, { ok: false, error: "Expected path and content." });
            return;
          }

          const normalizedRelativePath = body.path.replace(/\\/g, "/");
          const absolutePath = contentPathFromRelative(normalizedRelativePath);

          if (!isInsideRoot(contentRoot, absolutePath)) {
            sendJson(res, 400, { ok: false, error: "Refusing to save outside content." });
            return;
          }

          if (!absolutePath.endsWith(".md")) {
            sendJson(res, 400, { ok: false, error: "Only markdown files can be saved." });
            return;
          }

          if (absolutePath.includes(`${path.sep}generated-content${path.sep}`) || absolutePath.includes(`${path.sep}_generated${path.sep}`)) {
            sendJson(res, 400, {
              ok: false,
              error: "Generated-content files are managed through the output panel.",
            });
            return;
          }

          fs.writeFileSync(absolutePath, body.content, "utf8");
          sendJson(res, 200, {
            ok: true,
            path: normalizedRelativePath,
            savedAt: new Date().toISOString(),
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown save error.",
          });
        }
      });

      server.middlewares.use("/api/chatgpt-rpa/jobs", async (req, res, next) => {
        const requestPath = decodeURIComponent(req.url || "/").split("?")[0];
        const parts = requestPath.replace(/^\/+/, "").split("/").filter(Boolean);
        const jobId = parts[0];
        const action = parts[1];

        if (req.method === "POST" && !jobId) {
          try {
            const body = JSON.parse(await readRequestBody(req, maxRpaBodyBytes)) as ChatGptRpaStartInput;
            const validationErrors = validateRpaStartInput(body);

            if (validationErrors.length > 0) {
              sendJson(res, 400, { ok: false, error: validationErrors.join(" ") });
              return;
            }

            ensureGeneratedScaffold(body.projectFolder);
            const job = createRpaJob({
              ...body,
              versionLabel: normalizeRpaVersionLabel(body.versionLabel),
              outputFilename: normalizeRpaImageFilename(body.outputFilename),
            });
            chatGptRpaJobs.set(job.id, job);
            void runChatGptRpaJob(job);

            sendJson(res, 200, { ok: true, job: publicRpaJob(job) });
          } catch (error) {
            sendJson(res, 500, {
              ok: false,
              error: error instanceof Error ? error.message : "Unknown ChatGPT RPA start error.",
            });
          }
          return;
        }

        if (!jobId) {
          next();
          return;
        }

        const job = chatGptRpaJobs.get(jobId);
        if (!job) {
          sendJson(res, 404, { ok: false, error: `Unknown ChatGPT RPA job: ${jobId}` });
          return;
        }

        if (req.method === "GET" && !action) {
          sendJson(res, 200, { ok: true, job: publicRpaJob(job) });
          return;
        }

        if (req.method === "POST" && action === "resume") {
          if (job.status === "complete" || job.status === "cancelled") {
            sendJson(res, 200, { ok: true, job: publicRpaJob(job) });
            return;
          }

          job.error = undefined;
          void runChatGptRpaJob(job, true);
          sendJson(res, 200, { ok: true, job: publicRpaJob(job) });
          return;
        }

        if (req.method === "POST" && action === "cancel") {
          job.cancelled = true;
          setRpaJobStatus(job, "cancelled");
          for (const step of job.steps) {
            if (step.status === "queued" || step.status === "running" || step.status === "waiting") {
              setRpaStep(job, step.id, step.status === "waiting" ? "complete" : "failed", "Job cancelled.");
            }
          }

          try {
            await job.context?.close();
          } catch {
            // Ignore browser shutdown failures.
          }
          sendJson(res, 200, { ok: true, job: publicRpaJob(job) });
          return;
        }

        sendJson(res, 405, { ok: false, error: "Method not allowed" });
      });

      server.middlewares.use("/api/distribution", async (req, res) => {
        const url = new URL(req.url || "/", "http://localhost");
        const requestPath = decodeURIComponent(url.pathname).split("?")[0];
        const recordId = requestPath.replace(/^\/+/, "");
        try {
          migrateLegacyDistributionStore();
          const projectFolder = getStringQueryParam(url, "projectFolder");
          if (!projectFolder) {
            sendJson(res, 400, { ok: false, error: "projectFolder is required." });
            return;
          }
          const store = readDistributionStore(projectFolder);

          if (req.method === "GET" && !recordId) {
            sendJson(res, 200, { ok: true, records: store.records });
            return;
          }

          if (req.method === "POST" && !recordId) {
            let draft = JSON.parse(await readRequestBody(req, maxExportBodyBytes)) as DistributionDraft;
            const today = new Date().toLocaleDateString("en-CA");
            draft = withDefaultDistributionDate(draft, today);
            if (draft.projectFolder !== projectFolder) {
              sendJson(res, 400, { ok: false, error: "Distribution project does not match projectFolder." });
              return;
            }
            const errors = [...validateDistributionDraft(draft), ...distributionReferenceErrors({
              projectFolder: draft.projectFolder || "",
              contentSourcePath: draft.contentSourcePath,
              generatedContentIds: Array.isArray(draft.generatedContentIds) ? draft.generatedContentIds : [],
            })];
            if (errors.length) {
              sendJson(res, 400, { ok: false, error: errors.join(" ") });
              return;
            }
            const records = createDistributionRecordsFromDraft(draft, () => crypto.randomUUID(), new Date().toISOString());
            store.records.push(...records);
            writeDistributionStore(projectFolder, store);
            sendJson(res, 201, { ok: true, records });
            return;
          }

          const existingIndex = store.records.findIndex((record) => record.id === recordId);
          if (!recordId || existingIndex < 0) {
            sendJson(res, 404, { ok: false, error: "Distribution record not found." });
            return;
          }

          if (req.method === "PUT") {
            const candidate = JSON.parse(await readRequestBody(req, maxExportBodyBytes)) as DistributionRecord;
            const existing = store.records[existingIndex];
            const record: DistributionRecord = {
              ...candidate,
              id: existing.id,
              createdAt: existing.createdAt,
              updatedAt: new Date().toISOString(),
              generatedContentIds: Array.from(new Set(candidate.generatedContentIds || [])),
            };
            const errors = [...validateDistributionRecord(record), ...distributionReferenceErrors(record)];
            if (errors.length) {
              sendJson(res, 400, { ok: false, error: errors.join(" ") });
              return;
            }
            store.records[existingIndex] = record;
            writeDistributionStore(projectFolder, store);
            sendJson(res, 200, { ok: true, record });
            return;
          }

          if (req.method === "DELETE") {
            store.records.splice(existingIndex, 1);
            writeDistributionStore(projectFolder, store);
            sendJson(res, 200, { ok: true });
            return;
          }

          sendJson(res, 405, { ok: false, error: "Method not allowed" });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown distribution error.",
          });
        }
      });

      server.middlewares.use("/api/generated-content/folder", (req, res) => {
        try {
          const url = new URL(req.url || "", "http://localhost");
          const projectFolder = getStringQueryParam(url, "projectFolder");
          const category = getStringQueryParam(url, "category") || "documents";
          const contentSet = getStringQueryParam(url, "contentSet");

          if (!projectFolder) {
            sendJson(res, 400, { ok: false, error: "projectFolder is required." });
            return;
          }

          ensureGeneratedScaffold(projectFolder);
          const folder = getGeneratedCategoryFolder({ projectFolder, category, contentSet });

          sendJson(res, 200, {
            ok: true,
            folder: contentRelativePath(folder),
            generatedContentRoot: contentRelativePath(folder),
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown folder error.",
          });
        }
      });

      server.middlewares.use("/api/generated-content/list", (req, res) => {
        try {
          const url = new URL(req.url || "", "http://localhost");
          const projectFolder = getStringQueryParam(url, "projectFolder");
          const category = getStringQueryParam(url, "category") || "all";
          const contentSet = getStringQueryParam(url, "contentSet");

          if (!projectFolder) {
            sendJson(res, 400, { ok: false, error: "projectFolder is required." });
            return;
          }

          ensureGeneratedScaffold(projectFolder);

          const projectRoot = getProjectFolderAbsolute(projectFolder);
          const listRoot = category !== "all"
            ? path.join(projectRoot, normalizeGeneratedCategory(category))
            : projectRoot;
          const files = walkFiles(listRoot)
            .filter((absolutePath) => absolutePath.includes(`${path.sep}_generated${path.sep}`))
            .filter((absolutePath) => !contentSet || absolutePath.includes(`${path.sep}${contentSet}${path.sep}`))
            .map((absolutePath) => {
            const relativeFromGeneratedRoot = path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
            const relativeFromProjectRoot = contentRelativePath(absolutePath);
            const parts = relativeFromGeneratedRoot.split("/");
            const stat = fs.statSync(absolutePath);

            return {
              id: relativeFromProjectRoot,
              filename: path.basename(absolutePath),
              displayName: getGeneratedFileDisplayName(path.basename(absolutePath)),
              relativePath: relativeFromProjectRoot,
              generatedRelativePath: relativeFromGeneratedRoot,
              category: parts[0] || "documents",
              contentSet: parts[1] || "",
              versionLabel: getGeneratedFileVersionLabel(relativeFromGeneratedRoot),
              fileUrl: `/project-generated-content/${relativeFromProjectRoot}`,
              fileType: getFileType(absolutePath),
              sizeBytes: stat.size,
              modifiedAt: stat.mtime.toISOString(),
            };
          });

          sendJson(res, 200, {
            ok: true,
            projectFolder: normalizeProjectFolder(projectFolder),
            generatedContentRoot: contentRelativePath(projectRoot),
            files: files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown listing error.",
          });
        }
      });

      server.middlewares.use("/api/generated-content/export", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
          return;
        }

        try {
          const body = JSON.parse(await readRequestBody(req, maxExportBodyBytes)) as {
            projectFolder?: string;
            fileIds?: string[];
            format?: "pptx" | "pdf";
            outputFilename?: string;
            category?: string;
            contentSet?: string;
            versionLabel?: string;
          };

          if (!body.projectFolder || !Array.isArray(body.fileIds) || !body.fileIds.length || !body.format) {
            sendJson(res, 400, {
              ok: false,
              error: "Expected projectFolder, fileIds and format.",
            });
            return;
          }

          if (body.format !== "pptx" && body.format !== "pdf") {
            sendJson(res, 400, { ok: false, error: "Export format must be pptx or pdf." });
            return;
          }

          ensureGeneratedScaffold(body.projectFolder);

          const projectRoot = getProjectFolderAbsolute(body.projectFolder);
          const selectedFiles = body.fileIds.map((fileId) => {
            const absolutePath = contentPathFromRelative(fileId);

            if (
              !fs.existsSync(absolutePath) ||
              !isInsideRoot(projectRoot, absolutePath) ||
              !absolutePath.includes(`${path.sep}_generated${path.sep}`) ||
              !fs.statSync(absolutePath).isFile()
            ) {
              throw new Error(`Selected file is not inside a content-set _generated folder: ${fileId}`);
            }

            return absolutePath;
          });

          const unsupported = selectedFiles.filter((absolutePath) => !getImageMimeType(absolutePath));
          if (unsupported.length > 0) {
            sendJson(res, 400, {
              ok: false,
              error: `Only PNG and JPEG images can be exported. Unsupported: ${unsupported.map((item) => path.basename(item)).join(", ")}`,
            });
            return;
          }

          const generatedFolder = getGeneratedCategoryFolder({
            projectFolder: body.projectFolder,
            category: body.category || "visuals",
            contentSet: body.contentSet,
          });
          const selectedVersion = path.basename(path.dirname(selectedFiles[0]));
          const versionLabel = normalizeVersionFolder(body.versionLabel || (/^v\d{3,}$/i.test(selectedVersion) ? selectedVersion : getNextVersionFolderOnDisk(generatedFolder)));
          const finalRendersFolder = path.join(generatedFolder, versionLabel);
          ensureDirectory(finalRendersFolder);

          const baseName = body.outputFilename?.trim() || `${body.contentSet || "visual-set"}-${versionLabel}`;
          const cleanOutputFilename = safeFilename(`${stripDuplicateExtensions(baseName).replace(/\.[a-z0-9]+$/i, "")}.${body.format}`);
          const outputPath = uniqueAvailablePath(finalRendersFolder, cleanOutputFilename);

          if (body.format === "pptx") {
            const pptx = new pptxgen();
            pptx.layout = "LAYOUT_WIDE";
            pptx.author = "AI Prompt Builder";
            pptx.subject = "Generated visual export";
            pptx.title = path.parse(cleanOutputFilename).name;
            pptx.company = "AI Prompt Builder";

            for (const absolutePath of selectedFiles) {
              const imageBuffer = fs.readFileSync(absolutePath);
              const mimeType = getImageMimeType(absolutePath);
              const dimensions = getImageDimensions(absolutePath, imageBuffer);
              const rect = containRect({
                sourceWidth: dimensions.width,
                sourceHeight: dimensions.height,
                targetWidth: slideWidthInches,
                targetHeight: slideHeightInches,
              });
              const slide = pptx.addSlide();
              slide.background = { color: "FFFFFF" };
              slide.addImage({
                data: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
                x: rect.x,
                y: rect.y,
                w: rect.width,
                h: rect.height,
              });
            }

            await pptx.writeFile({ fileName: outputPath });
          } else {
            const pdf = await PDFDocument.create();

            for (const absolutePath of selectedFiles) {
              const imageBuffer = fs.readFileSync(absolutePath);
              const mimeType = getImageMimeType(absolutePath);
              const image = mimeType === "image/png"
                ? await pdf.embedPng(imageBuffer)
                : await pdf.embedJpg(imageBuffer);
              const page = pdf.addPage([pdfPageWidth, pdfPageHeight]);
              const rect = containRect({
                sourceWidth: image.width,
                sourceHeight: image.height,
                targetWidth: pdfPageWidth,
                targetHeight: pdfPageHeight,
              });

              page.drawImage(image, {
                x: rect.x,
                y: pdfPageHeight - rect.y - rect.height,
                width: rect.width,
                height: rect.height,
              });
            }

            fs.writeFileSync(outputPath, await pdf.save());
          }

          const relativeFromProjectRoot = contentRelativePath(outputPath);

          sendJson(res, 200, {
            ok: true,
            filename: path.basename(outputPath),
            relativePath: relativeFromProjectRoot,
            fileUrl: `/project-generated-content/${relativeFromProjectRoot}`,
            skipped: [],
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown export error.",
          });
        }
      });

      server.middlewares.use("/api/chatgpt-assist/import-latest-download", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
          return;
        }

        try {
          const body = JSON.parse(await readRequestBody(req, maxRpaBodyBytes)) as ChatGptAssistImportInput;
          const validationErrors = validateAssistImportInput(body);

          if (validationErrors.length > 0) {
            sendJson(res, 400, { ok: false, error: validationErrors.join(" ") });
            return;
          }

          ensureGeneratedScaffold(body.projectFolder);

          const config = mergeChatGptAssistConfig();
          const downloadsFolder = resolveUserPath(config.downloadsFolder || defaultChatGptAssistConfig.downloadsFolder);

          if (!fs.existsSync(downloadsFolder)) {
            sendJson(res, 404, {
              ok: false,
              error: `Downloads folder not found: ${downloadsFolder}`,
            });
            return;
          }

          const latestDownload = filterLatestAssistDownload(
            listAssistDownloadCandidates(downloadsFolder),
            body.runStartedAt
          );

          if (!latestDownload) {
            sendJson(res, 404, {
              ok: false,
              error: "No PNG, JPEG or WebP download was found after this assistant run started.",
            });
            return;
          }

          const targetFolder = getAssistVisualVersionFolder({
            projectFolder: body.projectFolder,
            contentSet: body.contentSet,
            versionLabel: body.versionLabel,
          });
          ensureDirectory(targetFolder);

          const cleanFilename = safeFilename(`${path.parse(normalizeAssistImageFilename(body.outputFilename, ".png")).name}.png`);
          const absolutePath = uniqueAvailablePath(targetFolder, cleanFilename);
          const visualsRoot = getGeneratedCategoryFolder({
            projectFolder: body.projectFolder,
            category: "visuals",
            contentSet: body.contentSet,
          });

          if (!isInsideRoot(visualsRoot, absolutePath)) {
            sendJson(res, 400, {
              ok: false,
              error: "Refusing to write outside the visual set's _generated folder.",
            });
            return;
          }

          const framedArtwork = await renderProductionArtwork(fs.readFileSync(latestDownload.path), body.masterFrame);
          fs.writeFileSync(absolutePath, framedArtwork);

          const relativeFromProjectRoot = contentRelativePath(absolutePath);

          sendJson(res, 200, {
            ok: true,
            filename: path.basename(absolutePath),
            relativePath: relativeFromProjectRoot,
            fileUrl: `/project-generated-content/${relativeFromProjectRoot}`,
            sourcePath: latestDownload.path,
            savedAt: new Date().toISOString(),
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown ChatGPT assistant import error.",
          });
        }
      });

      server.middlewares.use("/api/generated-content/render-document", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
          return;
        }
        try {
          const body = JSON.parse(await readRequestBody(req, maxExportBodyBytes)) as {
            projectFolder?: string;
            outputProfileId?: "a4_document_portrait" | "a4_pdf_portrait";
            outputFilename?: string;
            title?: string;
            markdown?: string;
            headerText?: string;
            footerText?: string;
            logoAsset?: string;
            contentSet?: string;
            versionLabel?: string;
          };
          if (!body.projectFolder || !body.contentSet || !body.outputProfileId || !body.markdown?.trim() || !body.logoAsset) {
            sendJson(res, 400, { ok: false, error: "Expected projectFolder, contentSet, outputProfileId, markdown and logoAsset." });
            return;
          }
          if (!getMasterFrameSpec(body.outputProfileId)) {
            sendJson(res, 400, { ok: false, error: "A fixed A4 master frame is required." });
            return;
          }
          ensureGeneratedScaffold(body.projectFolder);
          const generatedFolder = getGeneratedCategoryFolder({ projectFolder: body.projectFolder, category: "documents", contentSet: body.contentSet });
          const versionFolder = path.join(generatedFolder, body.versionLabel
            ? normalizeVersionFolder(body.versionLabel)
            : getNextVersionFolderOnDisk(generatedFolder));
          ensureDirectory(versionFolder);
          const format = body.outputProfileId === "a4_pdf_portrait" ? "pdf" : "docx";
          const baseName = path.parse(body.outputFilename?.trim() || body.title?.trim() || "rendered-document").name;
          const outputPath = uniqueAvailablePath(versionFolder, safeFilename(`${baseName}.${format}`));
          if (!isInsideRoot(generatedFolder, outputPath)) {
            throw new Error("Refusing to write outside the document pack's _generated folder.");
          }
          const bytes = await renderLockedDocument({
            format,
            markdown: body.markdown,
            title: body.title?.trim() || baseName,
            headerText: body.headerText?.trim() || "",
            footerText: body.footerText?.trim() || "",
            logoPath: getPathInsideProject(body.logoAsset, "Logo asset"),
          });
          fs.writeFileSync(outputPath, bytes);
          const relativePath = contentRelativePath(outputPath);
          sendJson(res, 200, {
            ok: true,
            filename: path.basename(outputPath),
            relativePath,
            fileUrl: `/project-generated-content/${relativePath}`,
            savedAt: new Date().toISOString(),
          });
        } catch (error) {
          sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Document rendering failed." });
        }
      });

      server.middlewares.use("/api/generated-content/upload", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
          return;
        }

        try {
          const body = JSON.parse(await readRequestBody(req)) as {
            projectFolder?: string;
            category?: string;
            filename?: string;
            targetFilename?: string;
            versionLabel?: string;
            contentSet?: string;
            masterFrame?: MasterFrameMetadata;
            dataBase64?: string;
          };

          if (!body.projectFolder || !body.category || !body.contentSet || !body.filename || !body.dataBase64) {
            sendJson(res, 400, {
              ok: false,
              error: "Expected projectFolder, category, contentSet, filename and dataBase64.",
            });
            return;
          }
          if (body.category === "visuals" && !body.masterFrame) {
            sendJson(res, 400, { ok: false, error: "Visual uploads require locked master-frame metadata." });
            return;
          }

          ensureGeneratedScaffold(body.projectFolder);

          const categoryFolder = getGeneratedCategoryFolder({
            projectFolder: body.projectFolder,
            category: body.category,
            contentSet: body.contentSet,
          });
          const outputFolder = path.join(categoryFolder, body.versionLabel
            ? normalizeVersionFolder(body.versionLabel)
            : getNextVersionFolderOnDisk(categoryFolder));

          if (!isInsideRoot(categoryFolder, outputFolder)) {
            sendJson(res, 400, {
              ok: false,
              error: "Target upload folder must stay inside the content set's _generated folder.",
            });
            return;
          }

          ensureDirectory(outputFolder);

          const originalExt = path.extname(body.filename);
          const candidateName = body.targetFilename
            ? body.targetFilename
            : body.filename;
          const withExtension = path.extname(candidateName)
            ? candidateName
            : `${candidateName}${originalExt || ".bin"}`;
          const shouldRenderArtwork = body.category === "visuals" && Boolean(body.masterFrame);
          const cleanFilename = safeFilename(shouldRenderArtwork ? `${path.parse(withExtension).name}.png` : withExtension);
          const decodedBytes = Buffer.from(body.dataBase64, "base64");

          if (decodedBytes.byteLength > maxUploadBytes) {
            sendJson(res, 413, {
              ok: false,
              error: `Uploaded file exceeds ${Math.round(maxUploadBytes / 1024 / 1024)} MB limit.`,
            });
            return;
          }

          const absolutePath = uniqueAvailablePath(outputFolder, cleanFilename);
          if (!isInsideRoot(categoryFolder, absolutePath)) {
            sendJson(res, 400, {
              ok: false,
              error: "Refusing to write outside the content set's _generated folder.",
            });
            return;
          }

          const outputBytes = shouldRenderArtwork
            ? await renderProductionArtwork(decodedBytes, body.masterFrame!)
            : decodedBytes;
          fs.writeFileSync(absolutePath, outputBytes);

          const relativeFromProjectRoot = contentRelativePath(absolutePath);

          sendJson(res, 200, {
            ok: true,
            filename: cleanFilename,
            relativePath: relativeFromProjectRoot,
            fileUrl: `/project-generated-content/${relativeFromProjectRoot}`,
            savedAt: new Date().toISOString(),
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown upload error.",
          });
        }
      });

      server.middlewares.use("/project-generated-content", (req, res) => {
        try {
          const requestPath = decodeURIComponent(req.url || "/").split("?")[0];
          const requestedFile = contentPathFromRelative(requestPath);

          if (
            !fs.existsSync(requestedFile) ||
            !isInsideRoot(contentRoot, requestedFile) ||
            !requestedFile.includes(`${path.sep}_generated${path.sep}`)
          ) {
            res.statusCode = 404;
            res.end("File not found");
            return;
          }

          const ext = path.extname(requestedFile).toLowerCase();
          const contentTypes: Record<string, string> = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".pdf": "application/pdf",
            ".md": "text/markdown; charset=utf-8",
            ".txt": "text/plain; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".csv": "text/csv; charset=utf-8",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          };

          res.statusCode = 200;
          res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
          fs.createReadStream(requestedFile).pipe(res);
        } catch (error) {
          res.statusCode = 500;
          res.end(error instanceof Error ? error.message : "Unknown error");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localFilePlugin()],
  server: {
    host: "0.0.0.0",
    port: 5177,
    strictPort: true,
    watch: {
      ignored: [
        "**/.local/**",
        "**/.local/chatgpt-rpa-profile/**",
        "**/automation/*.local.json",
      ],
    },
  },
});
