export type SaveContentResponse = {
  ok: boolean;
  path?: string;
  savedAt?: string;
  error?: string;
};

export type GeneratedOutputFile = {
  id: string;
  filename: string;
  relativePath: string;
  fileUrl: string;
  fileType: "image" | "pdf" | "document" | "presentation" | "text" | "other";
  sizeBytes: number;
  modifiedAt: string;
};

export type ListOutputsResponse = {
  ok: boolean;
  root?: string;
  files?: GeneratedOutputFile[];
  error?: string;
};

export async function saveContentSourceFile(
  path: string,
  content: string
): Promise<SaveContentResponse> {
  const response = await mainAppFetch("/api/content/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, content }),
  });

  return response.json() as Promise<SaveContentResponse>;
}

export async function listGeneratedOutputs(): Promise<GeneratedOutputFile[]> {
  const response = await mainAppFetch("/api/outputs/list");
  const payload = (await response.json()) as ListOutputsResponse;

  if (!payload.ok) {
    throw new Error(payload.error || "Could not list generated outputs.");
  }

  return payload.files || [];
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
import { mainAppFetch } from "./main-app-api";
