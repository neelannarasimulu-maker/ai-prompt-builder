import fs from "node:fs";
import path from "node:path";
import type { RuntimeProject } from "../../src/lib/prompt-builder/project-scaffold";

export function runtimeProjectFromFolder(brandId: string, projectId: string, folder: string): RuntimeProject {
  const projectMarkdown = path.join(folder, "project.md");
  const raw = fs.existsSync(projectMarkdown) ? fs.readFileSync(projectMarkdown, "utf8") : "";
  const workflow = raw.match(/^Workflow:\s*(presentation|document_pack|linkedin_campaign|mixed)\s*$/mi)?.[1] as RuntimeProject["workflow"];
  const label = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || projectId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
  return { id: projectId, label, brandId, folder: `content/projects/${brandId}/${projectId}`, workflow };
}
