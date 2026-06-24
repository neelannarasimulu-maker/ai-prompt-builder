import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pptxgen from "pptxgenjs";
import { PDFDocument } from "pdf-lib";
import { renderLockedMasterFrame, renderLockedDocument } from "../services/rendering-service";
import { getMasterFrameSpec } from "../../src/lib/prompt-builder/master-frame";
import type { MasterFrameMetadata } from "../../src/lib/prompt-builder/project-generated-content-api";
import {
  normalizeRpaImageFilename,
  normalizeRpaVersionLabel,
  validateRpaStartInput,
  type ChatGptRpaJob,
  type ChatGptRpaJobStatus,
  type ChatGptRpaStartInput,
  type ChatGptRpaStep,
  type ChatGptRpaStepStatus,
} from "../../src/lib/prompt-builder/chatgpt-rpa";
import {
  filterLatestAssistDownload,
  normalizeAssistImageFilename,
  normalizeAssistVersionLabel,
  validateAssistImportInput,
  type AssistDownloadCandidate,
  type ChatGptAssistImportInput,
} from "../../src/lib/prompt-builder/chatgpt-assist";
import {
  buildProjectScaffold,
  selectedScaffoldFiles,
  validateCreateProjectInput,
  type CreateProjectInput,
  type RuntimeContentFile,
  type RuntimeProject,
} from "../../src/lib/prompt-builder/project-scaffold";
import {
  createDistributionRecordsFromDraft,
  validateDistributionDraft,
  validateDistributionRecord,
  withDefaultDistributionDate,
  type DistributionDraft,
  type DistributionRecord,
} from "../../src/lib/prompt-builder/distribution";
import { readDistributionStoreFile, mergeDistributionStores, writeDistributionStoreFile, type DistributionStore } from "../repositories/distribution-repository";
import {
  contentSetTypes,
  defaultContentSetNames,
  isIgnoredContentPath,
  normalizeVersionFolder,
  parseContentSetPath,
  type ContentSetType,
} from "../../src/lib/prompt-builder/content-set-paths";
import {
  ensureContentSet,
  getNextVersionFolderOnDisk,
  migrateProjectStructure,
} from "../content-structure";
import { findLegacySettings, readSettings, writeSettings } from "../repositories/settings-repository";
import { createContentRepository } from "../repositories/content-repository";
import { getGeneratedFileDisplayName, getGeneratedFileVersionLabel } from "../repositories/generated-content-repository";
import { runtimeProjectFromFolder } from "../repositories/project-repository";
import { containRect } from "../services/export-service";
import { nowIso, readJsonFile, resolveUserPath } from "../services/automation-service";
import {
  copyFileToClipboard,
  ensureDirectory,
  getFileType,
  getImageDimensions,
  getImageMimeType,
  getStringQueryParam,
  isInsideRoot,
  readRequestBody,
  removeEmptyDirectoryTree,
  safeFilename,
  sendJson,
  slugSegment,
  stripDuplicateExtensions,
  uniqueAvailablePath,
  walkFiles,
} from "../services/file-service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "../..");
const defaultContentRoot = path.join(projectRoot, "content");
const appSettingsPath = path.join(projectRoot, ".local", "app-settings.json");
const savedAppSettings = readSettings(appSettingsPath);
const legacySettings = savedAppSettings.contentRoot ? { settings: {} } : findLegacySettings(appSettingsPath);
const migratedSettings = legacySettings.settings;
let contentRoot = path.resolve(process.env.PROMPT_BUILDER_CONTENT_ROOT || savedAppSettings.contentRoot || migratedSettings.contentRoot || defaultContentRoot);
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
function saveAppSettings(): void {
  writeSettings(appSettingsPath, { contentRoot });
  if (legacySettings.path && fs.existsSync(legacySettings.path)) fs.rmSync(legacySettings.path, { force: true });
}

if (!savedAppSettings.contentRoot && migratedSettings.contentRoot) saveAppSettings();

const { contentPathFromRelative, contentRelativePath, initializeContentRoot } = createContentRepository(
  () => contentRoot,
  defaultContentRoot
);

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

function ensureGeneratedScaffold(projectFolder: string): void {
  const projectRoot = getProjectFolderAbsolute(projectFolder);
  migrateProjectStructure(projectRoot);
  for (const category of contentSetTypes) ensureContentSet(projectRoot, category);
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
      const userDataDir = resolveUserPath(config.userDataDir, projectRoot);
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


export function createLocalAppRouteContext() {
  return {
    get contentRoot() { return contentRoot; },
    set contentRoot(value: string) { contentRoot = value; },
    fs,
    crypto,
    path,
    pptxgen,
    PDFDocument,
    renderLockedMasterFrame,
    renderLockedDocument,
    getMasterFrameSpec,
    normalizeRpaImageFilename,
    normalizeRpaVersionLabel,
    validateRpaStartInput,
    filterLatestAssistDownload,
    normalizeAssistImageFilename,
    normalizeAssistVersionLabel,
    validateAssistImportInput,
    buildProjectScaffold,
    selectedScaffoldFiles,
    validateCreateProjectInput,
    createDistributionRecordsFromDraft,
    validateDistributionDraft,
    validateDistributionRecord,
    withDefaultDistributionDate,
    readDistributionStoreFile,
    mergeDistributionStores,
    writeDistributionStoreFile,
    contentSetTypes,
    defaultContentSetNames,
    isIgnoredContentPath,
    normalizeVersionFolder,
    parseContentSetPath,
    ensureContentSet,
    getNextVersionFolderOnDisk,
    migrateProjectStructure,
    getGeneratedFileDisplayName,
    getGeneratedFileVersionLabel,
    runtimeProjectFromFolder,
    containRect,
    nowIso,
    readJsonFile,
    resolveUserPath,
    copyFileToClipboard,
    ensureDirectory,
    getFileType,
    getImageDimensions,
    getImageMimeType,
    getStringQueryParam,
    isInsideRoot,
    readRequestBody,
    removeEmptyDirectoryTree,
    safeFilename,
    sendJson,
    slugSegment,
    stripDuplicateExtensions,
    uniqueAvailablePath,
    walkFiles,
    projectRoot,
    defaultContentRoot,
    maxUploadBytes,
    maxExportBodyBytes,
    maxRpaBodyBytes,
    slideWidthInches,
    slideHeightInches,
    pdfPageWidth,
    pdfPageHeight,
    defaultChatGptRpaConfig,
    defaultChatGptAssistConfig,
    chatGptRpaJobs,
    allowedGeneratedCategories,
    saveAppSettings,
    contentPathFromRelative,
    contentRelativePath,
    initializeContentRoot,
    normalizeProjectFolder,
    getProjectFolderAbsolute,
    normalizeGeneratedCategory,
    resolveContentSetName,
    getGeneratedContentRoot,
    getDistributionStorePath,
    readDistributionStore,
    writeDistributionStore,
    migrateLegacyDistributionStore,
    distributionReferenceErrors,
    getGeneratedCategoryFolder,
    ensureGeneratedScaffold,
    mergeChatGptRpaConfig,
    mergeChatGptAssistConfig,
    getPathInsideProject,
    renderProductionArtwork,
    getAssistVisualVersionFolder,
    listAssistDownloadCandidates,
    getRpaVisualVersionFolder,
    getRpaSavedOutputPath,
    createRpaJob,
    publicRpaJob,
    setRpaJobStatus,
    setRpaStep,
    firstVisibleLocator,
    fillChatGptComposer,
    clickFirstVisible,
    waitForGeneratedImage,
    clickWithDownload,
    tryDownloadFromVisibleControls,
    downloadGeneratedImageFromChatGpt,
    runChatGptRpaJob,
    listRuntimeProjectsFromDisk,
    runtimeContentFiles,
  };
}

export type LocalAppRouteContext = ReturnType<typeof createLocalAppRouteContext>;

