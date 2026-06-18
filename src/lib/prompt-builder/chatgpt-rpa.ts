import {
  basenameWithoutExtension,
  getGeneratedVersionSortValue,
  stripDuplicateExtensions,
  type GeneratedContentFile,
} from "./project-generated-content-api";

export type ChatGptRpaStepStatus = "queued" | "running" | "waiting" | "complete" | "failed";

export type ChatGptRpaJobStatus =
  | "queued"
  | "running"
  | "waiting_for_user"
  | "complete"
  | "failed"
  | "cancelled";

export type ChatGptRpaStep = {
  id: string;
  label: string;
  status: ChatGptRpaStepStatus;
  message?: string;
  updatedAt: string;
};

export type ChatGptRpaJob = {
  id: string;
  status: ChatGptRpaJobStatus;
  steps: ChatGptRpaStep[];
  error?: string;
  savedFile?: {
    filename: string;
    relativePath: string;
    fileUrl: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type ChatGptRpaStartInput = {
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  outputType: string;
  prompt: string;
  projectFolder: string;
  outputFilename: string;
  logoAsset: string;
  versionLabel: string;
};

export type ChatGptRpaJobResponse = {
  ok: boolean;
  job?: ChatGptRpaJob;
  error?: string;
};

export function normalizeRpaVersionLabel(input?: string): string {
  const value = input?.trim();
  if (!value || value === "Unversioned") return "Version 1.0";
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 80);
}

export function getDefaultRpaVersionLabel(input: {
  selectedGeneratedVersion?: string;
  generatedFiles?: GeneratedContentFile[];
}): string {
  if (input.selectedGeneratedVersion?.trim() && input.selectedGeneratedVersion !== "Unversioned") {
    return normalizeRpaVersionLabel(input.selectedGeneratedVersion);
  }

  const versions = Array.from(
    new Set(
      (input.generatedFiles || [])
        .filter((file) => file.category === "visuals")
        .map((file) => file.versionLabel)
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => {
    const sortValue = getGeneratedVersionSortValue(b) - getGeneratedVersionSortValue(a);
    return sortValue || a.localeCompare(b);
  });

  return normalizeRpaVersionLabel(versions[0]);
}

export function normalizeRpaImageFilename(filename: string, fallbackExtension = ".png"): string {
  const cleaned = stripDuplicateExtensions(filename.trim() || "generated-visual.png");
  const extensionMatch = cleaned.match(/\.(png|jpe?g|webp)$/i);
  const extension = extensionMatch?.[0].toLowerCase() || fallbackExtension;
  return `${basenameWithoutExtension(cleaned)}${extension}`;
}

export function validateRpaStartInput(input: Partial<ChatGptRpaStartInput>): string[] {
  const errors: string[] = [];
  if (input.outputType !== "image") errors.push("Only image outputs can run through ChatGPT visual automation.");
  if (!input.prompt?.trim()) errors.push("A compiled prompt is required.");
  if (!input.projectFolder?.trim()) errors.push("Project folder is required.");
  if (!input.outputFilename?.trim()) errors.push("Output filename is required.");
  if (!input.logoAsset?.trim()) errors.push("Resolved logo asset is required.");
  if (!input.versionLabel?.trim()) errors.push("Target version folder is required.");
  return errors;
}

export async function startChatGptRpaJob(input: ChatGptRpaStartInput): Promise<ChatGptRpaJobResponse> {
  const response = await fetch("/api/chatgpt-rpa/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.json() as Promise<ChatGptRpaJobResponse>;
}

export async function getChatGptRpaJob(jobId: string): Promise<ChatGptRpaJobResponse> {
  const response = await fetch(`/api/chatgpt-rpa/jobs/${encodeURIComponent(jobId)}`);
  return response.json() as Promise<ChatGptRpaJobResponse>;
}

export async function resumeChatGptRpaJob(jobId: string): Promise<ChatGptRpaJobResponse> {
  const response = await fetch(`/api/chatgpt-rpa/jobs/${encodeURIComponent(jobId)}/resume`, {
    method: "POST",
  });
  return response.json() as Promise<ChatGptRpaJobResponse>;
}

export async function cancelChatGptRpaJob(jobId: string): Promise<ChatGptRpaJobResponse> {
  const response = await fetch(`/api/chatgpt-rpa/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
  });
  return response.json() as Promise<ChatGptRpaJobResponse>;
}
