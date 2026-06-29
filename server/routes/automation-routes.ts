import type { ViteDevServer } from "vite";
import type { CreateProjectInput } from "../../src/lib/prompt-builder/project-scaffold";
import type { ChatGptRpaStartInput } from "../../src/lib/prompt-builder/chatgpt-rpa";
import type { ChatGptAssistImportInput } from "../../src/lib/prompt-builder/chatgpt-assist";
import type { DistributionDraft, DistributionRecord } from "../../src/lib/prompt-builder/distribution";
import { getGeneratedContentAssetUrl } from "../../src/lib/prompt-builder/generated-content-contract";
import type { MasterFrameMetadata } from "../../src/lib/prompt-builder/project-generated-content-api";
import type { LocalAppRouteContext } from "../http/local-app-context";

export const automationRoutes = {
  jobs: "/api/chatgpt-rpa/jobs",
  importLatestDownload: "/api/chatgpt-assist/import-latest-download",
} as const;

export function registerAutomationRoutes(server: ViteDevServer, context: LocalAppRouteContext): void {
  const {
    fs,
    path,
    normalizeRpaImageFilename,
    normalizeRpaVersionLabel,
    validateRpaStartInput,
    filterLatestAssistDownload,
    normalizeAssistImageFilename,
    validateAssistImportInput,
    resolveUserPath,
    ensureDirectory,
    isInsideRoot,
    readRequestBody,
    safeFilename,
    sendJson,
    uniqueAvailablePath,
    projectRoot,
    maxRpaBodyBytes,
    defaultChatGptAssistConfig,
    chatGptRpaJobs,
    contentRelativePath,
    getGeneratedCategoryFolder,
    ensureGeneratedScaffold,
    mergeChatGptAssistConfig,
    renderProductionArtwork,
    getAssistVisualVersionFolder,
    listAssistDownloadCandidates,
    createRpaJob,
    publicRpaJob,
    setRpaJobStatus,
    setRpaStep,
    runChatGptRpaJob,
  } = context;

  server.middlewares.use(automationRoutes.jobs, async (req, res, next) => {
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

  server.middlewares.use(automationRoutes.importLatestDownload, async (req, res) => {
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
          const downloadsFolder = resolveUserPath(
            config.downloadsFolder || defaultChatGptAssistConfig.downloadsFolder,
            projectRoot,
          );

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

          const routePath = contentRelativePath(absolutePath);

          sendJson(res, 200, {
            ok: true,
            filename: path.basename(absolutePath),
            relativePath: routePath,
            routePath,
            fileUrl: getGeneratedContentAssetUrl(routePath),
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
}
