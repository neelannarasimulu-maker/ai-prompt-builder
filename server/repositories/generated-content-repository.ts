import { stripDuplicateExtensions } from "../services/file-service";

export function getGeneratedFileVersionLabel(generatedRelativePath: string): string | undefined {
  const segments = generatedRelativePath.replace(/\\/g, "/").split("/");
  const version = segments.find((segment) => /^version\s+\d+(?:\.\d+)?$/i.test(segment.trim()));
  return version?.trim();
}

export function getGeneratedFileDisplayName(filename: string): string {
  return stripDuplicateExtensions(filename)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
