import { brands, projects } from "../../lib/prompt-builder/registry";
import type { BrandItem, ProjectItem } from "./types";

export function listStaticBrands(): BrandItem[] {
  return brands as BrandItem[];
}

export function listStaticProjects(): ProjectItem[] {
  return projects as ProjectItem[];
}
