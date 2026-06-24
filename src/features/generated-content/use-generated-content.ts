import { useState } from "react";
import type { GeneratedContentCategory, GeneratedContentFile } from "../../lib/prompt-builder/project-generated-content-api";
import { useLocalStorageState } from "../../ui/hooks/use-local-storage-state";

export function useGeneratedContent(inferredCategory: Exclude<GeneratedContentCategory, "all">) {
  const [selectedGeneratedCategory, setSelectedGeneratedCategory] = useLocalStorageState<GeneratedContentCategory>("promptBuilder.selectedGeneratedCategory", inferredCategory);
  const [uploadCategory, setUploadCategory] = useLocalStorageState<Exclude<GeneratedContentCategory, "all">>("promptBuilder.uploadCategory", inferredCategory);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedContentFile[]>([]);
  const [selectedGeneratedFileId, setSelectedGeneratedFileId] = useLocalStorageState("promptBuilder.selectedGeneratedFileId", "");
  const [generatedSearch, setGeneratedSearch] = useLocalStorageState("promptBuilder.generatedSearch", "");
  const [selectedGeneratedVersion, setSelectedGeneratedVersion] = useLocalStorageState("promptBuilder.selectedGeneratedVersion", "");
  const [selectedGeneratedFileIds, setSelectedGeneratedFileIds] = useLocalStorageState<string[]>("promptBuilder.selectedGeneratedFileIds", []);
  const [isExportingGeneratedContent, setIsExportingGeneratedContent] = useState(false);
  const [isRenderingDocument, setIsRenderingDocument] = useState(false);
  const [targetFolder, setTargetFolder] = useState("");

  return {
    selectedGeneratedCategory, setSelectedGeneratedCategory, uploadCategory, setUploadCategory,
    generatedFiles, setGeneratedFiles, selectedGeneratedFileId, setSelectedGeneratedFileId,
    generatedSearch, setGeneratedSearch, selectedGeneratedVersion, setSelectedGeneratedVersion,
    selectedGeneratedFileIds, setSelectedGeneratedFileIds, isExportingGeneratedContent, setIsExportingGeneratedContent,
    isRenderingDocument, setIsRenderingDocument, targetFolder, setTargetFolder,
  };
}
