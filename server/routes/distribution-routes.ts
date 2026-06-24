import type { ViteDevServer } from "vite";
import type { CreateProjectInput } from "../../src/lib/prompt-builder/project-scaffold";
import type { ChatGptRpaStartInput } from "../../src/lib/prompt-builder/chatgpt-rpa";
import type { ChatGptAssistImportInput } from "../../src/lib/prompt-builder/chatgpt-assist";
import type { DistributionDraft, DistributionRecord } from "../../src/lib/prompt-builder/distribution";
import type { MasterFrameMetadata } from "../../src/lib/prompt-builder/project-generated-content-api";
import type { LocalAppRouteContext } from "../http/local-app-context";

export const distributionRoutes = {
  records: "/api/distribution",
} as const;

export function registerDistributionRoutes(server: ViteDevServer, context: LocalAppRouteContext): void {
  const {
    crypto,
    createDistributionRecordsFromDraft,
    validateDistributionDraft,
    validateDistributionRecord,
    withDefaultDistributionDate,
    getStringQueryParam,
    readRequestBody,
    sendJson,
    maxExportBodyBytes,
    readDistributionStore,
    writeDistributionStore,
    migrateLegacyDistributionStore,
    distributionReferenceErrors,
  } = context;

  server.middlewares.use(distributionRoutes.records, async (req, res) => {
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
}
