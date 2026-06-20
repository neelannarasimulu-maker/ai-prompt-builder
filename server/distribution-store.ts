import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { validateDistributionRecord, type DistributionRecord } from "../src/lib/prompt-builder/distribution";

export type DistributionStore = { version: 1; records: DistributionRecord[] };

export function mergeDistributionStores(existing: DistributionStore, incoming: DistributionRecord[]): DistributionStore {
  const merged = new Map(existing.records.map((record) => [record.id, record]));
  for (const record of incoming) if (!merged.has(record.id)) merged.set(record.id, record);
  return { version: 1, records: Array.from(merged.values()) };
}

export function readDistributionStoreFile(storePath: string): DistributionStore {
  if (!fs.existsSync(storePath)) return { version: 1, records: [] };
  const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as Partial<DistributionStore>;
  if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
    throw new Error("distribution.json has an unsupported or invalid structure.");
  }
  for (const record of parsed.records) {
    const errors = validateDistributionRecord(record);
    if (errors.length) throw new Error(`distribution.json contains an invalid record: ${errors.join(" ")}`);
  }
  return parsed as DistributionStore;
}

export function writeDistributionStoreFile(storePath: string, store: DistributionStore): void {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryPath, storePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
}
