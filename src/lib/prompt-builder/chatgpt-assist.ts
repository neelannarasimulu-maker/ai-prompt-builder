import {
  getDefaultRpaVersionLabel,
  normalizeRpaImageFilename,
  normalizeRpaVersionLabel,
} from "./chatgpt-rpa";
import type { GeneratedContentFile } from "./project-generated-content-api";

export type ChatGptAssistImportInput = {
  projectFolder: string;
  outputFilename: string;
  versionLabel: string;
  runStartedAt: string;
};

export type ChatGptAssistImportResponse = {
  ok: boolean;
  filename?: string;
  relativePath?: string;
  fileUrl?: string;
  sourcePath?: string;
  savedAt?: string;
  error?: string;
};

export type AssistDownloadCandidate = {
  path: string;
  filename: string;
  modifiedAt: string | Date;
  sizeBytes?: number;
};

export const normalizeAssistVersionLabel = normalizeRpaVersionLabel;
export const normalizeAssistImageFilename = normalizeRpaImageFilename;

export function getDefaultAssistVersionLabel(input: {
  selectedGeneratedVersion?: string;
  generatedFiles?: GeneratedContentFile[];
}): string {
  return getDefaultRpaVersionLabel(input);
}

export function isSupportedAssistDownloadFilename(filename: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(filename);
}

export function filterLatestAssistDownload(
  files: AssistDownloadCandidate[],
  runStartedAt: string | Date
): AssistDownloadCandidate | undefined {
  const startedAt = new Date(runStartedAt).getTime();
  if (!Number.isFinite(startedAt)) return undefined;

  return files
    .filter((file) => {
      const modifiedAt = new Date(file.modifiedAt).getTime();
      return (
        Number.isFinite(modifiedAt) &&
        modifiedAt >= startedAt &&
        isSupportedAssistDownloadFilename(file.filename)
      );
    })
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())[0];
}

export function validateAssistImportInput(input: Partial<ChatGptAssistImportInput>): string[] {
  const errors: string[] = [];
  if (!input.projectFolder?.trim()) errors.push("Project folder is required.");
  if (!input.outputFilename?.trim()) errors.push("Output filename is required.");
  if (!input.versionLabel?.trim()) errors.push("Target version folder is required.");
  if (!input.runStartedAt?.trim()) errors.push("Run start time is required.");
  if (input.runStartedAt && Number.isNaN(new Date(input.runStartedAt).getTime())) {
    errors.push("Run start time is invalid.");
  }
  return errors;
}

export async function importLatestChatGptDownload(
  input: ChatGptAssistImportInput
): Promise<ChatGptAssistImportResponse> {
  const response = await fetch("/api/chatgpt-assist/import-latest-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return response.json() as Promise<ChatGptAssistImportResponse>;
}
