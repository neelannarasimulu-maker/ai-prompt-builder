import type { ViteDevServer } from "vite";
import type { CreateProjectInput } from "../../src/lib/prompt-builder/project-scaffold";
import type { ChatGptRpaStartInput } from "../../src/lib/prompt-builder/chatgpt-rpa";
import type { ChatGptAssistImportInput } from "../../src/lib/prompt-builder/chatgpt-assist";
import type { DistributionDraft, DistributionRecord } from "../../src/lib/prompt-builder/distribution";
import type { MasterFrameMetadata } from "../../src/lib/prompt-builder/project-generated-content-api";
import type { LocalAppRouteContext } from "../http/local-app-context";

export const projectRoutes = {
  preview: "/api/projects/preview",
  projects: "/api/projects",
} as const;

export function registerProjectRoutes(server: ViteDevServer, context: LocalAppRouteContext): void {
  const {
    fs,
    crypto,
    path,
    buildProjectScaffold,
    selectedScaffoldFiles,
    validateCreateProjectInput,
    runtimeProjectFromFolder,
    ensureDirectory,
    isInsideRoot,
    readRequestBody,
    sendJson,
    listRuntimeProjectsFromDisk,
    runtimeContentFiles,
  } = context;

  server.middlewares.use(projectRoutes.preview, async (req, res) => {
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

  server.middlewares.use(projectRoutes.projects, async (req, res) => {
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
          const brandFolder = path.join(context.contentRoot, "brands", input.brandId);
          if (!fs.existsSync(brandFolder) || !fs.statSync(brandFolder).isDirectory() || fs.lstatSync(brandFolder).isSymbolicLink()) {
            sendJson(res, 400, { ok: false, error: `Brand ${input.brandId} is not available in the configured content root.` });
            return;
          }
          const parentFolder = path.join(context.contentRoot, "projects", input.brandId);
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
}
