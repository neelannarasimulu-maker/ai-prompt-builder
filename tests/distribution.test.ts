import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createDistributionRecordsFromDraft,
  filterDistributionRecords,
  isDistributionOverdue,
  sortSentDistribution,
  sortUpcomingDistribution,
  validateDistributionDraft,
  withDefaultDistributionDate,
  type DistributionDraft,
  type DistributionRecord,
} from "../src/lib/prompt-builder/distribution";
import { mergeDistributionStores, readDistributionStoreFile, writeDistributionStoreFile } from "../server/distribution-store";

function draft(overrides: Partial<DistributionDraft> = {}): DistributionDraft {
  return {
    projectFolder: "content/projects/demo/project",
    projectLabel: "Demo Project",
    contentLabel: "Demo Content",
    contentSourcePath: "content/projects/demo/project/documents/demo.md",
    generatedContentIds: [],
    recipients: ["Alex"],
    channel: "email",
    status: "planned",
    plannedDate: "2026-06-23",
    ...overrides,
  };
}

function record(overrides: Partial<DistributionRecord> = {}): DistributionRecord {
  return {
    ...createDistributionRecordsFromDraft(draft(), () => "record-1", "2026-06-20T00:00:00.000Z")[0],
    ...overrides,
  };
}

describe("distribution domain", () => {
  it("validates links, recipients, channels and dates", () => {
    expect(validateDistributionDraft(draft())).toEqual([]);
    expect(validateDistributionDraft(draft({ contentSourcePath: "", generatedContentIds: [] }))).toContain("Choose source content or at least one generated file.");
    expect(validateDistributionDraft(draft({ recipients: [] }))).toContain("At least one recipient is required.");
    expect(validateDistributionDraft(draft({ plannedDate: "2026-02-30" }))).toContain("Planned date must use YYYY-MM-DD.");
  });

  it("creates one independent record per unique recipient and keeps carousel files", () => {
    let id = 0;
    const records = createDistributionRecordsFromDraft(draft({
      recipients: ["Alex", "Priya", "Alex"],
      generatedContentIds: ["page-1.png", "page-2.png", "page-1.png"],
    }), () => `id-${++id}`, "2026-06-20T00:00:00.000Z");

    expect(records.map((item) => item.recipient)).toEqual(["Alex", "Priya"]);
    expect(records[0].generatedContentIds).toEqual(["page-1.png", "page-2.png"]);
    expect(records[0]).not.toHaveProperty("recipients");
    expect(records[0]).not.toHaveProperty("dateUnknown");
    expect(new Set(records.map((item) => item.id)).size).toBe(2);
  });

  it("defaults new dates to today while preserving explicit unknown sent dates", () => {
    expect(withDefaultDistributionDate(draft({ plannedDate: undefined }), "2026-06-20").plannedDate).toBe("2026-06-20");
    expect(withDefaultDistributionDate(draft({ status: "sent", plannedDate: undefined, sentDate: undefined }), "2026-06-20").sentDate).toBe("2026-06-20");
    expect(withDefaultDistributionDate(draft({ status: "sent", plannedDate: undefined, sentDate: undefined, dateUnknown: true }), "2026-06-20").sentDate).toBeUndefined();
  });

  it("filters, sorts and identifies overdue records", () => {
    const records = [
      record({ id: "late", plannedDate: "2026-06-19" }),
      record({ id: "future", plannedDate: "2026-06-25", channel: "linkedin", recipient: "LinkedIn" }),
      record({ id: "sent-known", status: "sent", sentDate: "2026-06-18" }),
      record({ id: "sent-unknown", status: "sent", plannedDate: undefined, sentDate: undefined }),
    ];
    expect(isDistributionOverdue(records[0], "2026-06-20")).toBe(true);
    expect(sortUpcomingDistribution(records).map((item) => item.id)).toEqual(["late", "future"]);
    expect(sortSentDistribution(records).map((item) => item.id)).toEqual(["sent-known", "sent-unknown"]);
    expect(filterDistributionRecords(records, { channel: "linkedin" }).map((item) => item.id)).toEqual(["future"]);
    expect(filterDistributionRecords(records, { recipient: "LinkedIn" }).map((item) => item.id)).toEqual(["future"]);
    expect(filterDistributionRecords(records, { search: "alex" })).toHaveLength(3);
    expect(filterDistributionRecords([record({ generatedContentIds: ["content/projects/demo/project/visuals/default-visual-set/_generated/v001/demo.png"] })], { folder: "visuals/default-visual-set/_generated/v001" })).toHaveLength(1);
  });
});

describe("distribution persistence", () => {
  it("writes atomically and reads valid records", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "prompt-builder-distribution-"));
    const storePath = path.join(directory, "distribution.json");
    try {
      const records = [record()];
      writeDistributionStoreFile(storePath, { version: 1, records });
      expect(readDistributionStoreFile(storePath).records).toEqual(records);
      expect((await readdir(directory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects corrupted storage without overwriting it", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "prompt-builder-distribution-"));
    const storePath = path.join(directory, "distribution.json");
    try {
      writeFileSync(storePath, "{broken", "utf8");
      expect(() => readDistributionStoreFile(storePath)).toThrow();
      expect(readFileSync(storePath, "utf8")).toBe("{broken");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("merges legacy records by ID without overwriting project-local edits", () => {
    const local = record({ id: "same", recipient: "Local edit" });
    const legacy = record({ id: "same", recipient: "Legacy value" });
    const added = record({ id: "new", recipient: "Preserved legacy record" });
    expect(mergeDistributionStores({ version: 1, records: [local] }, [legacy, added]).records).toEqual([local, added]);
  });
});

describe("LinkedIn distribution seed", () => {
  it("contains five posted records and the approved twice-weekly schedule", () => {
    const store = JSON.parse(readFileSync(new URL("../content/projects/supplysync360/public-linkedin/distribution.json", import.meta.url), "utf8")) as { records: DistributionRecord[] };
    expect(existsSync(new URL("../content/distribution.json", import.meta.url))).toBe(false);
    expect(store.records).toHaveLength(17);
    expect(store.records.slice(0, 5).every((item) => item.status === "sent" && !item.sentDate)).toBe(true);
    expect(store.records.slice(5).map((item) => item.plannedDate)).toEqual([
      "2026-06-23", "2026-06-25", "2026-06-30", "2026-07-02",
      "2026-07-07", "2026-07-09", "2026-07-14", "2026-07-16",
      "2026-07-21", "2026-07-23", "2026-07-28", "2026-07-30",
    ]);
  });

  it("preserves the project-local Thenga WhatsApp history", () => {
    const store = JSON.parse(readFileSync(new URL("../content/projects/thenga/standard-bank-pitch/distribution.json", import.meta.url), "utf8")) as { records: DistributionRecord[] };
    expect(store.records).toHaveLength(1);
    expect(store.records[0]).toMatchObject({ channel: "whatsapp", recipient: "Thenga Executive Team", sentDate: "2026-06-18" });
  });
});
