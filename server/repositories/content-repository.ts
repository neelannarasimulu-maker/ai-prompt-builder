import fs from "node:fs";
import path from "node:path";
import { ensureDirectory } from "../services/file-service";

export function createContentRepository(getContentRoot: () => string, defaultContentRoot: string) {
  function contentPathFromRelative(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^content\/?/, "");
    return path.resolve(getContentRoot(), normalized);
  }

  function contentRelativePath(absolutePath: string): string {
    return `content/${path.relative(getContentRoot(), absolutePath).replace(/\\/g, "/")}`;
  }

  function initializeContentRoot(targetRoot: string): void {
    ensureDirectory(targetRoot);
    ensureDirectory(path.join(targetRoot, "projects"));
    const sourceBrands = path.join(defaultContentRoot, "brands");
    const targetBrands = path.join(targetRoot, "brands");
    if (fs.existsSync(sourceBrands)) fs.cpSync(sourceBrands, targetBrands, { recursive: true, force: false, errorOnExist: false });
  }

  return { contentPathFromRelative, contentRelativePath, initializeContentRoot };
}
