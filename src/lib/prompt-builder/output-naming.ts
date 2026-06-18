export type OutputNamingInput = {
  contentPath?: string;
  contentFilename?: string;
  outputProfileId?: string;
  outputType?: "image" | "document" | "pdf" | "text" | "email";
  category?: string;
};

const extensionByOutputType: Record<string, string> = {
  image: "png",
  document: "docx",
  pdf: "pdf",
  text: "txt",
  email: "txt",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function getBaseNameFromPath(pathOrFilename?: string): string {
  if (!pathOrFilename) return "generated-output";
  const normalized = pathOrFilename.replace(/\\/g, "/");
  const filename = normalized.split("/").pop() || normalized;
  return slugify(filename) || "generated-output";
}

export function getExtensionForOutput(input: OutputNamingInput): string {
  if (input.outputProfileId?.includes("16_9") || input.outputProfileId?.includes("image")) {
    return "png";
  }
  if (input.outputProfileId?.includes("pdf")) return "pdf";
  if (input.outputProfileId?.includes("doc") || input.outputProfileId?.includes("word")) return "docx";
  if (input.outputProfileId?.includes("linkedin") && input.outputType === "text") return "txt";

  return extensionByOutputType[input.outputType || ""] || "png";
}

export function getSuggestedOutputFilename(input: OutputNamingInput): string {
  const base = getBaseNameFromPath(input.contentPath || input.contentFilename);
  const ext = getExtensionForOutput(input);
  return `${base}.${ext}`;
}

export function replaceExtension(filename: string, extension: string): string {
  const cleanExt = extension.replace(/^\./, "");
  const base = getBaseNameFromPath(filename);
  return `${base}.${cleanExt}`;
}
