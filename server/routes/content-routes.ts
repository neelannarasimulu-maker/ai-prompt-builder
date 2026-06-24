import type { ViteDevServer } from "vite";
import type { CreateProjectInput } from "../../src/lib/prompt-builder/project-scaffold";
import type { ChatGptRpaStartInput } from "../../src/lib/prompt-builder/chatgpt-rpa";
import type { ChatGptAssistImportInput } from "../../src/lib/prompt-builder/chatgpt-assist";
import type { DistributionDraft, DistributionRecord } from "../../src/lib/prompt-builder/distribution";
import type { MasterFrameMetadata } from "../../src/lib/prompt-builder/project-generated-content-api";
import type { LocalAppRouteContext } from "../http/local-app-context";

export const contentRoutes = {
  save: "/api/content/save",
  copyFile: "/api/clipboard/file",
} as const;

export function registerContentRoutes(server: ViteDevServer, context: LocalAppRouteContext): void {
  const {
    fs,
    path,
    copyFileToClipboard,
    isInsideRoot,
    readRequestBody,
    sendJson,
    contentPathFromRelative,
  } = context;

  server.middlewares.use(contentRoutes.save, async (req, res) => {
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

          if (!isInsideRoot(context.contentRoot, absolutePath)) {
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

  server.middlewares.use(contentRoutes.copyFile, async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
          return;
        }

        try {
          const body = JSON.parse(await readRequestBody(req)) as { path?: string };
          if (!body.path) {
            sendJson(res, 400, { ok: false, error: "Expected a content file path." });
            return;
          }

          const normalizedRelativePath = body.path.replace(/\\/g, "/");
          const absolutePath = contentPathFromRelative(normalizedRelativePath);
          if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
            sendJson(res, 404, { ok: false, error: "The selected file does not exist." });
            return;
          }

          const realContentRoot = fs.realpathSync(context.contentRoot);
          const realFilePath = fs.realpathSync(absolutePath);
          if (!isInsideRoot(realContentRoot, realFilePath)) {
            sendJson(res, 400, { ok: false, error: "Refusing to copy a file outside content." });
            return;
          }

          const allowedExtensions = new Set([".md", ".png", ".svg", ".jpg", ".jpeg", ".webp"]);
          if (!allowedExtensions.has(path.extname(realFilePath).toLowerCase())) {
            sendJson(res, 400, { ok: false, error: "Only Markdown and supported logo image files can be copied." });
            return;
          }

          await copyFileToClipboard(realFilePath);
          sendJson(res, 200, { ok: true, path: normalizedRelativePath, filename: path.basename(realFilePath) });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Could not copy the file to the clipboard.",
          });
        }
      });
}
