import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = __dirname;
const contentRoot = path.join(projectRoot, "content");

const allowedGeneratedCategories = new Set([
  "visuals",
  "documents",
  "pdfs",
  "linkedin-posts",
  "prompts",
  "backgrounds",
  "final-renders",
  "other",
]);

function ensureDirectory(directoryPath: string): void {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function isInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function readRequestBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
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

function normalizeProjectFolder(projectFolder: string): string {
  return projectFolder.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function getProjectFolderAbsolute(projectFolder: string): string {
  const normalizedProjectFolder = normalizeProjectFolder(projectFolder);
  const absoluteProjectFolder = path.resolve(projectRoot, normalizedProjectFolder);

  if (!absoluteProjectFolder.startsWith(contentRoot + path.sep)) {
    throw new Error("Project folder must be inside the content folder.");
  }

  return absoluteProjectFolder;
}

function getGeneratedContentRoot(projectFolder: string): string {
  return path.join(getProjectFolderAbsolute(projectFolder), "generated-content");
}

function getGeneratedCategoryFolder(input: {
  projectFolder: string;
  category: string;
}): string {
  const category = allowedGeneratedCategories.has(input.category)
    ? input.category
    : "other";

  return path.join(getGeneratedContentRoot(input.projectFolder), category);
}

function walkFiles(directoryPath: string): string[] {
  if (!fs.existsSync(directoryPath)) return [];

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (!entry.name.startsWith(".")) {
      files.push(fullPath);
    }
  }

  return files;
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

function getStringQueryParam(url: URL, name: string): string {
  return url.searchParams.get(name) || "";
}

function ensureGeneratedScaffold(projectFolder: string): void {
  for (const category of allowedGeneratedCategories) {
    ensureDirectory(getGeneratedCategoryFolder({ projectFolder, category }));
  }
}

function localFilePlugin(): Plugin {
  return {
    name: "prompt-builder-persist-output-name-api",
    configureServer(server) {
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
          const absolutePath = path.resolve(projectRoot, normalizedRelativePath);

          if (!absolutePath.startsWith(contentRoot + path.sep)) {
            sendJson(res, 400, { ok: false, error: "Refusing to save outside content." });
            return;
          }

          if (!absolutePath.endsWith(".md")) {
            sendJson(res, 400, { ok: false, error: "Only markdown files can be saved." });
            return;
          }

          if (absolutePath.includes(`${path.sep}generated-content${path.sep}`)) {
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

      server.middlewares.use("/api/generated-content/folder", (req, res) => {
        try {
          const url = new URL(req.url || "", "http://localhost");
          const projectFolder = getStringQueryParam(url, "projectFolder");
          const category = getStringQueryParam(url, "category") || "other";

          if (!projectFolder) {
            sendJson(res, 400, { ok: false, error: "projectFolder is required." });
            return;
          }

          ensureGeneratedScaffold(projectFolder);
          const folder = getGeneratedCategoryFolder({ projectFolder, category });

          sendJson(res, 200, {
            ok: true,
            folder: path.relative(projectRoot, folder).replace(/\\/g, "/"),
            generatedContentRoot: path.relative(projectRoot, getGeneratedContentRoot(projectFolder)).replace(/\\/g, "/"),
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

          if (!projectFolder) {
            sendJson(res, 400, { ok: false, error: "projectFolder is required." });
            return;
          }

          ensureGeneratedScaffold(projectFolder);

          const generatedRoot = getGeneratedContentRoot(projectFolder);
          const listRoot = category !== "all"
            ? getGeneratedCategoryFolder({ projectFolder, category })
            : generatedRoot;

          ensureDirectory(listRoot);

          const files = walkFiles(listRoot).map((absolutePath) => {
            const relativeFromGeneratedRoot = path.relative(generatedRoot, absolutePath).replace(/\\/g, "/");
            const relativeFromProjectRoot = path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
            const parts = relativeFromGeneratedRoot.split("/");
            const stat = fs.statSync(absolutePath);

            return {
              id: relativeFromProjectRoot,
              filename: path.basename(absolutePath),
              relativePath: relativeFromProjectRoot,
              generatedRelativePath: relativeFromGeneratedRoot,
              category: parts[0] || "other",
              fileUrl: `/project-generated-content/${relativeFromProjectRoot}`,
              fileType: getFileType(absolutePath),
              sizeBytes: stat.size,
              modifiedAt: stat.mtime.toISOString(),
            };
          });

          sendJson(res, 200, {
            ok: true,
            projectFolder: normalizeProjectFolder(projectFolder),
            generatedContentRoot: path.relative(projectRoot, generatedRoot).replace(/\\/g, "/"),
            files: files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown listing error.",
          });
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
            dataBase64?: string;
          };

          if (!body.projectFolder || !body.category || !body.filename || !body.dataBase64) {
            sendJson(res, 400, {
              ok: false,
              error: "Expected projectFolder, category, filename and dataBase64.",
            });
            return;
          }

          ensureGeneratedScaffold(body.projectFolder);

          const outputFolder = getGeneratedCategoryFolder({
            projectFolder: body.projectFolder,
            category: body.category,
          });

          ensureDirectory(outputFolder);

          const originalExt = path.extname(body.filename);
          const candidateName = body.targetFilename
            ? body.targetFilename
            : body.filename;
          const withExtension = path.extname(candidateName)
            ? candidateName
            : `${candidateName}${originalExt || ".bin"}`;
          const cleanFilename = safeFilename(withExtension);
          const absolutePath = path.resolve(outputFolder, cleanFilename);
          const generatedRoot = getGeneratedContentRoot(body.projectFolder);

          if (!isInsideRoot(generatedRoot, absolutePath)) {
            sendJson(res, 400, {
              ok: false,
              error: "Refusing to write outside generated-content.",
            });
            return;
          }

          fs.writeFileSync(absolutePath, Buffer.from(body.dataBase64, "base64"));

          const relativeFromProjectRoot = path.relative(projectRoot, absolutePath).replace(/\\/g, "/");

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
          const requestedFile = path.resolve(projectRoot, requestPath.replace(/^\/+/, ""));

          if (
            !fs.existsSync(requestedFile) ||
            !isInsideRoot(contentRoot, requestedFile) ||
            !requestedFile.includes(`${path.sep}generated-content${path.sep}`)
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
  server: { port: 5177 },
});
