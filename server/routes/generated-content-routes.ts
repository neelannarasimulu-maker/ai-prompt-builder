import type { ViteDevServer } from "vite";
import sharp from "sharp";
import type { CreateProjectInput } from "../../src/lib/prompt-builder/project-scaffold";
import type { ChatGptRpaStartInput } from "../../src/lib/prompt-builder/chatgpt-rpa";
import type { ChatGptAssistImportInput } from "../../src/lib/prompt-builder/chatgpt-assist";
import type { DistributionDraft, DistributionRecord } from "../../src/lib/prompt-builder/distribution";
import {
  generatedContentRoutes,
  getGeneratedContentAssetUrl,
} from "../../src/lib/prompt-builder/generated-content-contract";
import type { MasterFrameMetadata } from "../../src/lib/prompt-builder/project-generated-content-api";
import type { LocalAppRouteContext } from "../http/local-app-context";

export function registerGeneratedContentRoutes(server: ViteDevServer, context: LocalAppRouteContext): void {
  const {
    fs,
    path,
    pptxgen,
    PDFDocument,
    renderLockedDocument,
    getMasterFrameSpec,
    normalizeVersionFolder,
    getNextVersionFolderOnDisk,
    getGeneratedFileDisplayName,
    getGeneratedFileVersionLabel,
    containRect,
    ensureDirectory,
    getFileType,
    getImageDimensions,
    getImageMimeType,
    getStringQueryParam,
    isInsideRoot,
    readRequestBody,
    safeFilename,
    sendJson,
    stripDuplicateExtensions,
    uniqueAvailablePath,
    walkFiles,
    projectRoot,
    maxUploadBytes,
    maxExportBodyBytes,
    slideWidthInches,
    slideHeightInches,
    pdfPageWidth,
    pdfPageHeight,
    contentPathFromRelative,
    contentRelativePath,
    normalizeProjectFolder,
    getProjectFolderAbsolute,
    normalizeGeneratedCategory,
    getGeneratedCategoryFolder,
    ensureGeneratedScaffold,
    getPathInsideProject,
    renderProductionArtwork,
  } = context;

  async function pdfOptimizedImageBytes(absolutePath: string): Promise<Buffer> {
    const imageBuffer = fs.readFileSync(absolutePath);
    const mimeType = getImageMimeType(absolutePath);
    if (!mimeType) return imageBuffer;
    if (mimeType === "image/jpeg") {
      return sharp(imageBuffer).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    }
    return sharp(imageBuffer)
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  }

  server.middlewares.use(generatedContentRoutes.folder, (req, res) => {
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

  server.middlewares.use(generatedContentRoutes.list, (req, res) => {
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
            const projectRelativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
            const routePath = contentRelativePath(absolutePath);
            const parts = projectRelativePath.split("/");
            const stat = fs.statSync(absolutePath);

            return {
              id: routePath,
              routePath,
              projectRelativePath,
              filename: path.basename(absolutePath),
              displayName: getGeneratedFileDisplayName(path.basename(absolutePath)),
              relativePath: routePath,
              generatedRelativePath: projectRelativePath,
              category: parts[0] || "documents",
              contentSet: parts[1] || "",
              versionLabel: getGeneratedFileVersionLabel(projectRelativePath),
              fileUrl: getGeneratedContentAssetUrl(routePath),
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

  server.middlewares.use(generatedContentRoutes.export, async (req, res) => {
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
              const imageBuffer = await pdfOptimizedImageBytes(absolutePath);
              const metadata = await sharp(imageBuffer).metadata();
              const image = await pdf.embedJpg(imageBuffer);
              const page = pdf.addPage([pdfPageWidth, pdfPageHeight]);
              const rect = containRect({
                sourceWidth: metadata.width || image.width,
                sourceHeight: metadata.height || image.height,
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

            fs.writeFileSync(outputPath, await pdf.save({ useObjectStreams: true }));
          }

          const routePath = contentRelativePath(outputPath);

          sendJson(res, 200, {
            ok: true,
            filename: path.basename(outputPath),
            relativePath: routePath,
            routePath,
            fileUrl: getGeneratedContentAssetUrl(routePath),
            skipped: [],
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown export error.",
          });
        }
      });

  server.middlewares.use(generatedContentRoutes.renderDocument, async (req, res) => {
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
            routePath: relativePath,
            fileUrl: getGeneratedContentAssetUrl(relativePath),
            savedAt: new Date().toISOString(),
          });
        } catch (error) {
          sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Document rendering failed." });
        }
      });

  server.middlewares.use(generatedContentRoutes.upload, async (req, res) => {
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

          const routePath = contentRelativePath(absolutePath);

          sendJson(res, 200, {
            ok: true,
            filename: cleanFilename,
            relativePath: routePath,
            routePath,
            fileUrl: getGeneratedContentAssetUrl(routePath),
            savedAt: new Date().toISOString(),
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown upload error.",
          });
        }
      });

  server.middlewares.use(generatedContentRoutes.assets, (req, res) => {
        try {
          const requestPath = decodeURIComponent(req.url || "/").split("?")[0];
          const requestedFile = contentPathFromRelative(requestPath);

          if (
            !fs.existsSync(requestedFile) ||
            !isInsideRoot(context.contentRoot, requestedFile) ||
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
}
