import type { ViteDevServer } from "vite";
import type { CreateProjectInput } from "../../src/lib/prompt-builder/project-scaffold";
import type { ChatGptRpaStartInput } from "../../src/lib/prompt-builder/chatgpt-rpa";
import type { ChatGptAssistImportInput } from "../../src/lib/prompt-builder/chatgpt-assist";
import type { DistributionDraft, DistributionRecord } from "../../src/lib/prompt-builder/distribution";
import type { MasterFrameMetadata } from "../../src/lib/prompt-builder/project-generated-content-api";
import type { LocalAppRouteContext } from "../http/local-app-context";

export const storageRoutes = {
  status: "/api/storage/status",
  settings: "/api/storage/settings",
} as const;

export function registerStorageRoutes(server: ViteDevServer, context: LocalAppRouteContext): void {
  const {
    fs,
    path,
    ensureDirectory,
    readRequestBody,
    sendJson,
    saveAppSettings,
    initializeContentRoot,
  } = context;

  server.middlewares.use(storageRoutes.status, (_req, res) => {
        let writable = false;
        try {
          ensureDirectory(context.contentRoot);
          fs.accessSync(context.contentRoot, fs.constants.R_OK | fs.constants.W_OK);
          writable = true;
        } catch {
          writable = false;
        }
        sendJson(res, 200, { ok: true, localApiAvailable: true, contentRoot: context.contentRoot, writable, version: "1.0" });
      });

  server.middlewares.use(storageRoutes.settings, async (req, res) => {
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
          context.contentRoot = nextRoot;
          saveAppSettings();
          sendJson(res, 200, { ok: true, localApiAvailable: true, contentRoot: context.contentRoot, writable: true, version: "1.0" });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Could not update content root." });
        }
      });
}
