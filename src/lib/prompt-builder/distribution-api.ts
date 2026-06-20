import { mainAppFetch } from "./main-app-api";
import type { DistributionDraft, DistributionRecord } from "./distribution";

type DistributionResponse = { ok: boolean; records?: DistributionRecord[]; record?: DistributionRecord; error?: string };

async function distributionRequest(path: string, init?: RequestInit): Promise<DistributionResponse> {
  const response = await mainAppFetch(path, init);
  const payload = await response.json() as DistributionResponse;
  if (!payload.ok) throw new Error(payload.error || "Distribution request failed.");
  return payload;
}

function distributionPath(projectFolder: string, id?: string): string {
  const base = id ? `/api/distribution/${encodeURIComponent(id)}` : "/api/distribution";
  return `${base}?${new URLSearchParams({ projectFolder }).toString()}`;
}

export async function listDistributionRecords(projectFolder: string): Promise<DistributionRecord[]> {
  const payload = await distributionRequest(distributionPath(projectFolder));
  return payload.records || [];
}

export async function createDistributionRecords(input: DistributionDraft): Promise<DistributionRecord[]> {
  const payload = await distributionRequest(distributionPath(input.projectFolder), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.records || [];
}

export async function updateDistributionRecord(id: string, input: DistributionRecord): Promise<DistributionRecord> {
  const payload = await distributionRequest(distributionPath(input.projectFolder, id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!payload.record) throw new Error("Updated distribution record was not returned.");
  return payload.record;
}

export async function deleteDistributionRecord(projectFolder: string, id: string): Promise<void> {
  await distributionRequest(distributionPath(projectFolder, id), { method: "DELETE" });
}
