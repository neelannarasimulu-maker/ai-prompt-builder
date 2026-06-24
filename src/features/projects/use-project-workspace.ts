import { useEffect, useMemo, useState } from "react";
import { getProjectContentEntries } from "../../core/content/static-content-repository";
import { listStaticProjects } from "../../core/registry/registry-repository";
import type { BrandItem, ContentEntry, ProjectItem } from "../../core/registry/types";
import { getStorageStatus, listRuntimeProjects, loadRuntimeProject, type RuntimeContentFile, type RuntimeProject } from "../../lib/prompt-builder";
import { useLocalStorageState } from "../../ui/hooks/use-local-storage-state";

export function useProjectWorkspace(brandList: BrandItem[]) {
  const [runtimeProjects, setRuntimeProjects] = useState<RuntimeProject[]>([]);
  const [runtimeFilesByProject, setRuntimeFilesByProject] = useState<Record<string, RuntimeContentFile[]>>({});
  const projectList = useMemo(() => {
    const merged = new Map<string, ProjectItem>();
    for (const project of listStaticProjects()) merged.set(`${project.brandId}/${project.id}`, project);
    for (const project of runtimeProjects) merged.set(`${project.brandId}/${project.id}`, project);
    return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [runtimeProjects]);

  const [storageRoot, setStorageRoot] = useState("");
  const [storageState, setStorageState] = useState<"checking" | "available" | "read-only">("checking");
  const [selectedBrandId, setSelectedBrandId] = useLocalStorageState("promptBuilder.selectedBrandId", brandList[0]?.id ?? "");
  const filteredProjects = useMemo(() => projectList.filter((project) => project.brandId === selectedBrandId), [projectList, selectedBrandId]);
  const [selectedProjectId, setSelectedProjectId] = useLocalStorageState("promptBuilder.selectedProjectId", filteredProjects[0]?.id ?? "");

  useEffect(() => {
    if (!filteredProjects.find((project) => project.id === selectedProjectId)) setSelectedProjectId(filteredProjects[0]?.id ?? "");
  }, [filteredProjects, selectedProjectId, setSelectedProjectId]);

  const selectedBrand = useMemo(() => brandList.find((brand) => brand.id === selectedBrandId) ?? null, [brandList, selectedBrandId]);
  const selectedProject = useMemo(() => filteredProjects.find((project) => project.id === selectedProjectId) ?? null, [filteredProjects, selectedProjectId]);

  async function refreshRuntimeRepository() {
    try {
      const status = await getStorageStatus();
      setStorageState(status.writable ? "available" : "read-only");
      setStorageRoot(status.contentRoot || "");
      const payload = await listRuntimeProjects();
      setRuntimeProjects(payload.projects || []);
    } catch {
      setStorageState("read-only");
    }
  }

  useEffect(() => { void refreshRuntimeRepository(); }, []);
  useEffect(() => {
    if (!selectedProject || storageState !== "available") return;
    void loadRuntimeProject(selectedProject.brandId, selectedProject.id)
      .then((payload) => setRuntimeFilesByProject((current) => ({ ...current, [`${payload.project.brandId}/${payload.project.id}`]: payload.files })))
      .catch(() => undefined);
  }, [selectedProjectId, selectedProject?.brandId, storageState]);

  const activeRuntimeFiles = selectedProject ? runtimeFilesByProject[`${selectedProject.brandId}/${selectedProject.id}`] || [] : [];
  const allProjectContent = useMemo(() => {
    if (!selectedProject) return [];
    const merged = new Map<string, ContentEntry>();
    for (const entry of getProjectContentEntries(selectedProject)) merged.set(entry.path, entry);
    for (const entry of activeRuntimeFiles) {
      if (entry.type !== "project" && entry.contentSet) merged.set(entry.path, entry as ContentEntry);
    }
    return Array.from(merged.values()).sort((a, b) => a.type.localeCompare(b.type) || a.filename.localeCompare(b.filename));
  }, [selectedProject, activeRuntimeFiles]);

  return {
    runtimeProjects, setRuntimeProjects, runtimeFilesByProject, setRuntimeFilesByProject,
    projectList, storageRoot, setStorageRoot, storageState, setStorageState,
    localWritesAvailable: storageState === "available", selectedBrandId, setSelectedBrandId,
    filteredProjects, selectedProjectId, setSelectedProjectId, selectedBrand, selectedProject,
    refreshRuntimeRepository, activeRuntimeFiles, allProjectContent,
  };
}
